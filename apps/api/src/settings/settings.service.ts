import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import { UpdateWhatsappConfigDto } from './dto/update-whatsapp-config.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private readonly evolutionUrl: string;
  private readonly evolutionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.evolutionUrl = this.config.get<string>('evolution.apiUrl') ?? 'http://localhost:8080';
    this.evolutionKey = this.config.get<string>('evolution.apiKey') ?? '';
    this.logger.log(`Evolution API URL: ${this.evolutionUrl}`);
    this.logger.log(`Evolution API Key: ${this.evolutionKey ? '***' + this.evolutionKey.slice(-4) : 'NOT SET'}`);
  }

  async getBusinessRules(companyId: string) {
    const [rules, company] = await Promise.all([
      this.prisma.businessRules.findUnique({ where: { companyId } }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { schedulingMode: true } }),
    ]);
    if (!rules) throw new NotFoundException('Regras de negócio não encontradas');
    return { ...rules, schedulingMode: company?.schedulingMode ?? 'HYBRID' };
  }

  async updateBusinessRules(companyId: string, dto: UpdateBusinessRulesDto, userId: string) {
    const existing = await this.prisma.businessRules.findUnique({ where: { companyId } });
    if (!existing) throw new NotFoundException('Regras de negócio não encontradas');

    const [updated] = await Promise.all([
      this.prisma.businessRules.update({
        where: { companyId },
        data: {
          cancellationAllowed: dto.cancellationAllowed,
          cancellationMinHours: dto.cancellationMinHours,
          autoBlockEnabled: dto.autoBlockEnabled,
          autoBlockAfterAbsences: dto.autoBlockAfterAbsences,
          autoBlockWindowDays: dto.autoBlockWindowDays,
          autoBlockDurationDays: dto.autoBlockDurationDays,
          autoReturnEnabled: dto.autoReturnEnabled,
          autoReturnAfterDays: dto.autoReturnAfterDays,
          autoReturnMessage: dto.autoReturnMessage,
          requireConfirmation: dto.requireConfirmation,
          confirmationDeadlineHours: dto.confirmationDeadlineHours,
        },
      }),
      ...(dto.schedulingMode
        ? [this.prisma.company.update({ where: { id: companyId }, data: { schedulingMode: dto.schedulingMode } })]
        : []),
    ]);

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'BusinessRules',
      entityId: existing.id,
      oldValue: {
        cancellationMinHours: existing.cancellationMinHours,
        autoBlockEnabled: existing.autoBlockEnabled,
      },
      newValue: dto as unknown as Record<string, unknown>,
    });

    return { ...updated, schedulingMode: dto.schedulingMode ?? 'HYBRID' };
  }

  async getWhatsappConfig(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: {
        id: true,
        companyId: true,
        instanceName: true,
        isConnected: true,
        phoneNumber: true,
        greetingMessage: true,
        scheduleConfirmMsg: true,
        reminderMessage: true,
        cancellationMessage: true,
        queueCalledMessage: true,
        reminderRules: true,
        autoConfirmEnabled: true,
        autoConfirmHours: true,
        dailyReminderEnabled: true,
        dailyReminderTime: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');
    return config;
  }

  async updateWhatsappConfig(companyId: string, dto: UpdateWhatsappConfigDto, userId: string) {
    const existing = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!existing) throw new NotFoundException('Configuração WhatsApp não encontrada');

    const updated = await this.prisma.whatsappConfig.update({
      where: { companyId },
      data: {
        greetingMessage: dto.greetingMessage,
        scheduleConfirmMsg: dto.scheduleConfirmMsg,
        reminderMessage: dto.reminderMessage,
        cancellationMessage: dto.cancellationMessage,
        queueCalledMessage: dto.queueCalledMessage,
        ...(dto.reminderRules !== undefined ? { reminderRules: JSON.parse(JSON.stringify(dto.reminderRules)) } : {}),
        ...(dto.autoConfirmEnabled !== undefined ? { autoConfirmEnabled: dto.autoConfirmEnabled } : {}),
        ...(dto.autoConfirmHours !== undefined ? { autoConfirmHours: dto.autoConfirmHours } : {}),
        ...(dto.dailyReminderEnabled !== undefined ? { dailyReminderEnabled: dto.dailyReminderEnabled } : {}),
        ...(dto.dailyReminderTime !== undefined ? { dailyReminderTime: dto.dailyReminderTime } : {}),
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'WhatsappConfig',
      entityId: existing.id,
      newValue: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  private evoHeaders() {
    return { apikey: this.evolutionKey, 'Content-Type': 'application/json' };
  }

  async getConnectionStatus(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    try {
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connectionState/${config.instanceName}`,
        { headers: this.evoHeaders(), timeout: 5000 },
      );
      const state = res.data?.instance?.state ?? res.data?.state ?? 'close';
      const connected = state === 'open';

      if (config.isConnected !== connected) {
        await this.prisma.whatsappConfig.update({
          where: { companyId },
          data: { isConnected: connected },
        });
      }

      return { instanceName: config.instanceName, connected, state, phoneNumber: config.phoneNumber };
    } catch {
      return { instanceName: config.instanceName, connected: false, state: 'close', phoneNumber: config.phoneNumber };
    }
  }

  async generateQr(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    const headers = this.evoHeaders();
    const instanceName = config.instanceName;

    // 1) Tentar conectar instância existente (retorna QR se desconectada)
    try {
      const connectRes = await axios.get(
        `${this.evolutionUrl}/instance/connect/${instanceName}`,
        { headers, timeout: 15000 },
      );
      const base64 = connectRes.data?.base64 ?? connectRes.data?.qrcode?.base64 ?? null;
      if (base64) {
        this.logger.log(`QR obtido via connect para ${instanceName}`);
        return { qrcode: base64 };
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        this.logger.debug(`connect ${instanceName} status=${status}`);

        // Instância não existe — criar abaixo
        if (status === 404) {
          return this.createInstanceAndGetQr(instanceName, headers);
        }

        // Connection refused
        if (!err.response) {
          return {
            qrcode: null,
            error: 'Não foi possível conectar à Evolution API. Verifique se o serviço está rodando.',
          };
        }
      }
    }

    // 2) Tentar buscar QR code diretamente
    try {
      const qrRes = await axios.get(
        `${this.evolutionUrl}/instance/qrcode/base64/${instanceName}`,
        { headers, timeout: 10000 },
      );
      const base64 = qrRes.data?.qrcode?.base64 ?? qrRes.data?.base64 ?? null;
      if (base64) return { qrcode: base64 };
    } catch {
      this.logger.debug(`qrcode/base64 não disponível para ${instanceName}`);
    }

    // 3) Se nenhum QR obtido, tentar criar instância
    return this.createInstanceAndGetQr(instanceName, headers);
  }

  private async createInstanceAndGetQr(
    instanceName: string,
    headers: Record<string, string>,
  ): Promise<{ qrcode: string | null; error?: string }> {
    try {
      const createRes = await axios.post(
        `${this.evolutionUrl}/instance/create`,
        {
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          token: this.evolutionKey,
          qrcode: true,
        },
        { headers, timeout: 15000 },
      );
      const base64 = createRes.data?.qrcode?.base64 ?? createRes.data?.base64 ?? null;
      this.logger.log(`Instância ${instanceName} criada, QR: ${base64 ? 'SIM' : 'NÃO'}`);
      return { qrcode: base64 };
    } catch (createErr: unknown) {
      if (axios.isAxiosError(createErr)) {
        const body = createErr.response?.data;

        // Já existe — tentar connect novamente
        if (createErr.response?.status === 403 && JSON.stringify(body).includes('already in use')) {
          this.logger.log(`Instância ${instanceName} já existe, tentando connect...`);
          try {
            const connectRes = await axios.get(
              `${this.evolutionUrl}/instance/connect/${instanceName}`,
              { headers, timeout: 15000 },
            );
            const base64 = connectRes.data?.base64 ?? connectRes.data?.qrcode?.base64 ?? null;
            return { qrcode: base64 };
          } catch {
            return { qrcode: null, error: 'Instância existe mas não foi possível obter QR. Tente novamente.' };
          }
        }

        const msg = JSON.stringify(body ?? createErr.message);
        this.logger.error(`Falha ao criar instância ${instanceName}: ${msg}`);
        return { qrcode: null, error: `Falha ao criar instância: ${msg}` };
      }
      return { qrcode: null, error: 'Erro inesperado ao criar instância' };
    }
  }

  async disconnectWhatsapp(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    try {
      await axios.delete(
        `${this.evolutionUrl}/instance/logout/${config.instanceName}`,
        { headers: this.evoHeaders(), timeout: 5000 },
      );
    } catch {
      // ignore — update DB regardless
    }

    await this.prisma.whatsappConfig.update({
      where: { companyId },
      data: { isConnected: false },
    });

    return { disconnected: true };
  }
}
