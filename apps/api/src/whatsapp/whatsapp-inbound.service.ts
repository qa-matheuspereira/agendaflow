import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappClientBotService } from './whatsapp-client-bot.service';
import { WhatsappCollaboratorBotService } from './whatsapp-collaborator-bot.service';
import type { EvolutionMessageData, EvolutionAckData } from './interfaces/evolution-payload.interface';

const CONVERSATION_TTL_MS = 30 * 60 * 1000;

/**
 * Normalize WhatsApp JID — strip device suffix (:10, :2, etc.) before @.
 * '15930184695888:10@lid' → '15930184695888@lid'
 * '5511999999999:5@s.whatsapp.net' → '5511999999999@s.whatsapp.net'
 */
function normalizeJid(jid: string): string {
  const atIdx = jid.indexOf('@');
  if (atIdx === -1) return jid;
  const local = jid.slice(0, atIdx).split(':')[0];
  return `${local}${jid.slice(atIdx)}`;
}

function stripJid(jid: string): string {
  const norm = normalizeJid(jid);
  // Keep full @lid JID — Evolution API needs it to send messages back
  if (norm.includes('@lid')) return norm;
  return norm.split('@')[0];
}

function numberForLookup(jid: string): string {
  return normalizeJid(jid).split('@')[0];
}

// Brazilian numbers: Evolution API may omit the 9th digit for older numbers.
// If lookup with bare number fails, try adding/removing the 9th digit.
function brazilianAlternate(number: string): string | null {
  // 55 + DDD (2 digits) + number
  if (!number.startsWith('55') || number.length < 12) return null;
  const ddd = number.slice(2, 4);
  const local = number.slice(4);
  if (local.length === 9 && local.startsWith('9')) {
    // 13-digit → try 12-digit (remove the leading 9)
    return `55${ddd}${local.slice(1)}`;
  }
  if (local.length === 8) {
    // 12-digit → try 13-digit (add leading 9)
    return `55${ddd}9${local}`;
  }
  return null;
}

function extractText(data: EvolutionMessageData): string {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    ''
  ).trim();
}

function conversationExpiresAt(): Date {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

@Injectable()
export class WhatsappInboundService {
  private readonly logger = new Logger(WhatsappInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly clientBot: WhatsappClientBotService,
    private readonly collaboratorBot: WhatsappCollaboratorBotService,
  ) {}

  async processMessage(instanceName: string, data: EvolutionMessageData): Promise<void> {
    if (data.key.fromMe) return;
    if (data.key.remoteJid.endsWith('@g.us')) return; // grupo

    // Só mensagens de texto
    const isText =
      data.messageType === 'conversation' || data.messageType === 'extendedTextMessage';
    if (!isText) {
      this.logger.debug(`Mensagem não textual ignorada: tipo=${data.messageType}`);
      return;
    }

    const messageText = extractText(data);
    if (!messageText) return;

    const config = await this.prisma.whatsappConfig.findUnique({ where: { instanceName } });
    if (!config) {
      this.logger.warn(`Webhook recebido para instância não registrada: ${instanceName}`);
      return;
    }

    const rawNumber = stripJid(data.key.remoteJid);
    const isLid = data.key.remoteJid.includes('@lid');
    const rawLidNumber = isLid ? numberForLookup(data.key.remoteJid) : null;
    let lookupNumber = numberForLookup(data.key.remoteJid);

    // @lid é um ID opaco do WhatsApp — tenta resolver para número real via Evolution API
    if (isLid) {
      const resolved = await this.whatsapp.resolvePhoneFromLid(instanceName, data.key.remoteJid);
      if (resolved) lookupNumber = resolved;
    }

    // sendNumber: número usado para ENVIAR mensagens (precisa ser telefone, não @lid)
    // Se @lid não foi resolvido, usa os dígitos do @lid (pode funcionar em alguns casos)
    const sendNumber = isLid ? lookupNumber : rawNumber;

    this.logger.debug(`Lookup: rawJid=${data.key.remoteJid} lookupNumber=${lookupNumber} sendNumber=${sendNumber}`);

    const altNumber = brazilianAlternate(lookupNumber);
    const numberVariants = altNumber ? [lookupNumber, altNumber] : [lookupNumber];

    // Busca colaborador por telefone OU pelo @lid salvo (whatsappLid)
    const collaboratorWhere = rawLidNumber
      ? {
          companyId: config.companyId,
          isActive: true,
          OR: [
            { whatsappNumber: { in: numberVariants } },
            { whatsappLid: rawLidNumber },
          ],
        }
      : { companyId: config.companyId, whatsappNumber: { in: numberVariants }, isActive: true };

    // Para @lid: também busca pelo rawNumber armazenado (ex: '15930184695888@lid')
    const clientWhere = isLid
      ? {
          companyId: config.companyId,
          OR: [
            { whatsappNumber: { in: numberVariants } },
            { whatsappNumber: rawNumber },
          ],
        }
      : { companyId: config.companyId, whatsappNumber: { in: numberVariants } };

    const [collaborator, client] = await Promise.all([
      this.prisma.collaborator.findFirst({
        where: collaboratorWhere,
        select: { id: true, name: true, whatsappLid: true },
      }),
      this.prisma.client.findFirst({
        where: clientWhere,
        select: { id: true, name: true, isBlocked: true },
      }),
    ]);

    this.logger.debug(`Resolved: collaborator=${collaborator?.name ?? 'NOT FOUND'} client=${client?.name ?? 'NOT FOUND'}`);

    // Persiste o @lid no colaborador para lookups futuros sem precisar de resolução
    if (collaborator && rawLidNumber && !collaborator.whatsappLid) {
      this.prisma.collaborator.update({
        where: { id: collaborator.id },
        data: { whatsappLid: rawLidNumber },
      }).catch(() => { /* non-critical */ });
    }

    const now = new Date();
    const existing = await this.prisma.conversationState.findUnique({
      where: {
        companyId_whatsappNumber: { companyId: config.companyId, whatsappNumber: lookupNumber },
      },
    });

    const isExpired = !existing || existing.expiresAt < now;

    const state = await this.prisma.conversationState.upsert({
      where: {
        companyId_whatsappNumber: { companyId: config.companyId, whatsappNumber: lookupNumber },
      },
      create: {
        companyId: config.companyId,
        whatsappNumber: lookupNumber,
        currentStep: 'IDLE',
        context: {},
        expiresAt: conversationExpiresAt(),
      },
      update: {
        currentStep: isExpired ? 'IDLE' : undefined,
        context: isExpired ? {} : undefined,
        expiresAt: conversationExpiresAt(),
      },
    });

    // Human-like response delay
    await new Promise((r) => setTimeout(r, 5000));

    if (collaborator) {
      await this.collaboratorBot.handle(
        instanceName,
        sendNumber,
        messageText,
        collaborator,
        state,
        config.companyId,
      );
      return;
    }

    const step = state.currentStep;
    const hasPlaceholderName = client?.name === 'Cliente WhatsApp';

    if (client) {
      // Known client with placeholder name → collect real name first
      if (hasPlaceholderName && step !== 'COLLECT_NAME') {
        await this.whatsapp.sendText(instanceName, sendNumber, 'Para continuar, qual é o seu nome?');
        await this.prisma.conversationState.update({
          where: { companyId_whatsappNumber: { companyId: config.companyId, whatsappNumber: lookupNumber } },
          data: { currentStep: 'COLLECT_NAME', context: {}, expiresAt: conversationExpiresAt() },
        });
        return;
      }

      // Client already has real name but landed in COLLECT_NAME → skip to menu
      if (step === 'COLLECT_NAME' && !hasPlaceholderName) {
        await this.clientBot.handleClient(instanceName, sendNumber, messageText, client, state, config, config.companyId);
        return;
      }

      if (step === 'COLLECT_NAME' && !isExpired) {
        await this.clientBot.handleNameCollection(instanceName, sendNumber, messageText, config, config.companyId);
      } else if (WhatsappClientBotService.isBookingStep(step) && !isExpired) {
        await this.clientBot.handleBookingStep(
          instanceName,
          sendNumber,
          messageText,
          client.id,
          state,
          config.companyId,
        );
      } else if (step === 'MAIN_MENU' && !isExpired) {
        await this.clientBot.handleMenuReply(
          instanceName,
          sendNumber,
          messageText,
          client,
          config,
          config.companyId,
        );
      } else {
        await this.clientBot.handleClient(
          instanceName,
          sendNumber,
          messageText,
          client,
          state,
          config,
          config.companyId,
        );
      }
      return;
    }

    this.logger.log(`Remetente desconhecido ${sendNumber} (empresa: ${config.companyId})`);

    if (step === 'COLLECT_NAME' && !isExpired) {
      await this.clientBot.handleNameCollection(instanceName, sendNumber, messageText, config, config.companyId);
    } else if (WhatsappClientBotService.isBookingStep(step) && !isExpired) {
      await this.clientBot.handleBookingStep(
        instanceName,
        sendNumber,
        messageText,
        null,
        state,
        config.companyId,
      );
    } else if (step === 'MAIN_MENU' && !isExpired) {
      await this.clientBot.handleMenuReply(
        instanceName,
        sendNumber,
        messageText,
        null,
        config,
        config.companyId,
      );
    } else {
      await this.clientBot.handleUnknown(instanceName, sendNumber, config, config.companyId);
    }
  }

  async processDeliveryUpdate(instanceName: string, data: EvolutionAckData): Promise<void> {
    const msgId = data.key?.id;
    if (!msgId) return;

    // Evolution API status: SERVER_ACK → DELIVERY_ACK → READ
    const status = data.update?.status;
    if (status === 'DELIVERY_ACK') {
      await this.prisma.notification.updateMany({
        where: { evolutionMsgId: msgId, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
    } else if (status === 'READ') {
      await this.prisma.notification.updateMany({
        where: { evolutionMsgId: msgId, readAt: null },
        data: { readAt: new Date() },
      });
    }
  }
}
