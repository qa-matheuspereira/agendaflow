import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { ScheduleEngineService } from '@/schedule-engine/schedule-engine.service';
import { AppointmentStatus, QueueStatus, QueuePriority, SchedulingMode, Prisma } from '@prisma/client';
import type { ConversationState, WhatsappConfig } from '@prisma/client';
import { differenceInMinutes } from 'date-fns';

const DEFAULT_GREETING = 'Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?';
const CONVERSATION_TTL_MS = 30 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

interface BookingContext {
  collaborators?: string[];
  selectedCollaboratorId?: string;
  services?: string[];
  selectedServiceId?: string;
  dates?: string[];       // available dates YYYY-MM-DD list shown to user
  selectedDate?: string;
  slots?: string[];
  appointmentIds?: string[];
}

function conversationExpiresAt(): Date {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = new Date().getFullYear();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) return null;
  return dateStr;
}

const BOOKING_STEPS = [
  'SELECT_COLLABORATOR',
  'SELECT_SERVICE',
  'SELECT_DATE',
  'SELECT_SLOT',
  'SELECT_QUEUE_SERVICE',
  'LIST_CANCELABLE',
  'NO_COLLABORATOR_QUEUE_OFFER',
];

const DAY_NAMES_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

@Injectable()
export class WhatsappClientBotService {
  private readonly logger = new Logger(WhatsappClientBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly scheduleEngine: ScheduleEngineService,
  ) {}

  private async queueEnabled(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { schedulingMode: true },
    });
    return (
      company?.schedulingMode === SchedulingMode.QUEUE_ONLY ||
      company?.schedulingMode === SchedulingMode.HYBRID
    );
  }

  private async buildMenu(companyId: string): Promise<string> {
    const withQueue = await this.queueEnabled(companyId);
    const lines = [
      '*Menu de atendimento*',
      '',
      '1 - Agendar horário',
      '2 - Ver meus agendamentos',
      '3 - Cancelar agendamento',
    ];
    if (withQueue) {
      lines.push('4 - Entrar na fila');
      lines.push('5 - Consultar posição na fila');
    }
    lines.push('', 'Digite o número da opção desejada.');
    return lines.join('\n');
  }

  private async setState(
    companyId: string,
    whatsappNumber: string,
    currentStep: string,
    context: object = {},
  ): Promise<void> {
    const stateKey = whatsappNumber.split('@')[0];
    await this.prisma.conversationState.update({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: stateKey } },
      data: { currentStep, context, expiresAt: conversationExpiresAt() },
    });
  }

  private async showMainMenu(instanceName: string, rawNumber: string, companyId: string): Promise<void> {
    const menu = await this.buildMenu(companyId);
    await this.whatsapp.sendText(instanceName, rawNumber, menu);
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  // ─── Public entry points ──────────────────────────────────────────────────

  async handleUnknown(
    instanceName: string,
    rawNumber: string,
    config: WhatsappConfig,
    companyId: string,
  ): Promise<void> {
    const greeting = config.greetingMessage?.trim() || DEFAULT_GREETING;
    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      `${greeting}\n\nPara começar, qual é o seu nome?`,
    );
    await this.setState(companyId, rawNumber, 'COLLECT_NAME');
  }

  async handleNameCollection(
    instanceName: string,
    rawNumber: string,
    name: string,
    config: WhatsappConfig,
    companyId: string,
  ): Promise<void> {
    const cleanName = name.trim().slice(0, 100);
    if (!cleanName || cleanName.length < 2) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Por favor, informe seu nome completo.');
      return;
    }

    const existing = await this.prisma.client.findUnique({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: rawNumber } },
      select: { name: true },
    });
    const shouldUpdateName = !existing || existing.name === 'Cliente WhatsApp';

    const client = await this.prisma.client.upsert({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: rawNumber } },
      create: { companyId, whatsappNumber: rawNumber, name: cleanName },
      update: shouldUpdateName ? { name: cleanName } : {},
    });

    const menu = await this.buildMenu(companyId);
    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      `Olá, *${client.name}*! 👋\n\n${menu}`,
    );
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  async handleClient(
    instanceName: string,
    rawNumber: string,
    messageText: string,
    client: { id: string; name: string; isBlocked: boolean },
    state: ConversationState,
    config: WhatsappConfig,
    companyId: string,
  ): Promise<void> {
    if (client.isBlocked) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Sua conta está bloqueada. Entre em contato com o estabelecimento para mais informações.',
      );
      return;
    }

    // Evita duplicidade: só exibe menu/saudação se o estado estiver IDLE ou expirado.
    // Se já está em MAIN_MENU o handleMenuReply será chamado pelo inbound.
    const menu = await this.buildMenu(companyId);
    const greeting = config.greetingMessage?.trim() || DEFAULT_GREETING;
    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      `${greeting}\n\nOlá, *${client.name}*! 👋\n\n${menu}`,
    );
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  async handleMenuReply(
    instanceName: string,
    rawNumber: string,
    messageText: string,
    client: { id: string; name: string; isBlocked: boolean } | null,
    config: WhatsappConfig,
    companyId: string,
  ): Promise<void> {
    if (client?.isBlocked) return;

    const option = messageText.trim().match(/^(\d)/)?.[1] ?? '';

    switch (option) {
      case '1':
        await this.startBookingFlow(instanceName, rawNumber, companyId);
        break;

      case '2':
        if (client) {
          await this.handleViewAppointments(instanceName, rawNumber, client.id, companyId);
        } else {
          await this.whatsapp.sendText(instanceName, rawNumber, 'Você ainda não possui agendamentos.');
        }
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
        break;

      case '5':
        if (client) {
          await this.handleQueuePosition(instanceName, rawNumber, client.id, companyId);
        } else {
          await this.whatsapp.sendText(instanceName, rawNumber, 'Você não está em nenhuma fila no momento.');
        }
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
        break;

      case '4':
        await this.startQueueFlow(instanceName, rawNumber, companyId);
        break;

      case '3':
        await this.startCancelFlow(instanceName, rawNumber, companyId, client?.id ?? null);
        break;

      default: {
        const menu = await this.buildMenu(companyId);
        await this.whatsapp.sendText(
          instanceName,
          rawNumber,
          `Opção inválida. Escolha uma das opções:\n\n${menu}`,
        );
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
      }
    }
  }

  /** Handles SELECT_COLLABORATOR / SELECT_SERVICE / SELECT_DATE / SELECT_SLOT steps. */
  async handleBookingStep(
    instanceName: string,
    rawNumber: string,
    messageText: string,
    clientId: string | null,
    state: ConversationState,
    companyId: string,
  ): Promise<void> {
    const ctx = (state.context ?? {}) as BookingContext;

    switch (state.currentStep) {
      case 'SELECT_COLLABORATOR':
        await this.handleCollaboratorSelection(instanceName, rawNumber, messageText, ctx, companyId);
        break;
      case 'SELECT_SERVICE':
        await this.handleServiceSelection(instanceName, rawNumber, messageText, ctx, companyId);
        break;
      case 'SELECT_DATE':
        await this.handleDateInput(instanceName, rawNumber, messageText, ctx, companyId);
        break;
      case 'SELECT_SLOT':
        await this.handleSlotSelection(instanceName, rawNumber, messageText, ctx, companyId, clientId);
        break;
      case 'SELECT_QUEUE_SERVICE':
        await this.handleQueueServiceSelection(instanceName, rawNumber, messageText, ctx, companyId, clientId);
        break;
      case 'LIST_CANCELABLE':
        await this.handleCancellationSelection(instanceName, rawNumber, messageText, ctx, companyId, clientId);
        break;
      case 'NO_COLLABORATOR_QUEUE_OFFER': {
        const opt = messageText.trim();
        if (opt === '1') {
          await this.startQueueFlow(instanceName, rawNumber, companyId);
        } else {
          await this.showMainMenu(instanceName, rawNumber, companyId);
        }
        break;
      }
      default:
        await this.startBookingFlow(instanceName, rawNumber, companyId);
    }
  }

  static isBookingStep(step: string): boolean {
    return BOOKING_STEPS.includes(step);
  }

  // ─── Booking flow ─────────────────────────────────────────────────────────

  private async startBookingFlow(
    instanceName: string,
    rawNumber: string,
    companyId: string,
  ): Promise<void> {
    const cfg = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: { skipCollaboratorSelection: true, allowMultipleServices: true },
    });
    const skipCollab = cfg?.skipCollaboratorSelection ?? false;
    const multiService = cfg?.allowMultipleServices ?? false;

    const collaborators = await this.prisma.collaborator.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (collaborators.length === 0) {
      // Sem colaboradores: vai direto para serviços OU oferece fila
      const withQueue = await this.queueEnabled(companyId);
      const services = await this.prisma.service.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { name: 'asc' },
      });

      if (services.length === 0) {
        if (withQueue) {
          await this.whatsapp.sendText(
            instanceName,
            rawNumber,
            'Nenhum profissional disponível para agendamento no momento.\n\nMas você pode entrar na fila de espera e ser chamado quando houver disponibilidade!\n\n1 - Entrar na fila\n0 - Voltar ao menu',
          );
          await this.setState(companyId, rawNumber, 'NO_COLLABORATOR_QUEUE_OFFER');
        } else {
          await this.whatsapp.sendText(
            instanceName,
            rawNumber,
            'Nenhum profissional disponível no momento. Entre em contato com o estabelecimento.',
          );
          await this.setState(companyId, rawNumber, 'MAIN_MENU');
        }
        return;
      }

      // Tem serviços, sem colaborador — pula direto pra seleção de serviço
      await this.showServiceMenu(instanceName, rawNumber, services, multiService, companyId, null);
      return;
    }

    // Tem colaboradores mas skipCollaboratorSelection ativo — pula seleção de profissional
    if (skipCollab) {
      const services = await this.prisma.service.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { name: 'asc' },
      });

      if (services.length === 0) {
        await this.whatsapp.sendText(instanceName, rawNumber, 'Nenhum serviço disponível no momento.');
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
        return;
      }

      await this.showServiceMenu(instanceName, rawNumber, services, multiService, companyId, null);
      return;
    }

    // Fluxo normal: escolher profissional
    const lines = ['*Escolha o profissional:*', ''];
    collaborators.forEach((c, i) => lines.push(`${i + 1} - ${c.name}`));
    lines.push('', '0 - Voltar ao menu');
    lines.push('', 'Digite o número do profissional desejado.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'SELECT_COLLABORATOR', {
      collaborators: collaborators.map((c) => c.id),
    } as BookingContext);
  }

  /** Helper: exibe menu de serviços (com suporte a multi-seleção) */
  private async showServiceMenu(
    instanceName: string,
    rawNumber: string,
    services: { id: string; name: string; durationMinutes: number; price: unknown }[],
    multiService: boolean,
    companyId: string,
    selectedCollaboratorId: string | null,
  ): Promise<void> {
    const lines: string[] = [];

    if (multiService) {
      lines.push('*Escolha os serviços desejados:*', '');
      lines.push('Você pode selecionar mais de um serviço! Digite os números separados por vírgula.');
      lines.push('Exemplo: _1,3_ para selecionar o 1º e o 3º serviço.', '');
    } else {
      lines.push('*Escolha o serviço:*', '');
    }

    services.forEach((s, i) => {
      const price = Number(s.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      lines.push(`${i + 1} - ${s.name} • ${s.durationMinutes} min • ${price}`);
    });
    lines.push('', '0 - Voltar ao menu');
    if (!multiService) lines.push('', 'Digite o número do serviço desejado.');

    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));
    await this.setState(companyId, rawNumber, 'SELECT_SERVICE', {
      selectedCollaboratorId,
      services: services.map((s) => s.id),
    } as BookingContext);
  }

  private async handleCollaboratorSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
  ): Promise<void> {
    const collaborators = ctx.collaborators ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showMainMenu(instanceName, rawNumber, companyId);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= collaborators.length) {
      await this.startBookingFlow(instanceName, rawNumber, companyId);
      return;
    }

    const selectedCollaboratorId = collaborators[idx];

    const services = await this.prisma.service.findMany({
      where: {
        companyId,
        isActive: true,
        collaborators: { some: { collaboratorId: selectedCollaboratorId } },
      },
      select: { id: true, name: true, durationMinutes: true, price: true },
      orderBy: { name: 'asc' },
    });

    if (services.length === 0) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Nenhum serviço disponível para este profissional. Escolha outro:',
      );
      await this.startBookingFlow(instanceName, rawNumber, companyId);
      return;
    }

    const cfg = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: { allowMultipleServices: true },
    });
    const multiService = cfg?.allowMultipleServices ?? false;

    await this.showServiceMenu(instanceName, rawNumber, services, multiService, companyId, selectedCollaboratorId);

    // update context to include collaborators list for back-navigation
    const stateKey = rawNumber.split('@')[0];
    await this.prisma.conversationState.update({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: stateKey } },
      data: { context: { collaborators, selectedCollaboratorId, services: services.map((s) => s.id) } },
    });
  }

  private async handleServiceSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
  ): Promise<void> {
    const services = ctx.services ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.startBookingFlow(instanceName, rawNumber, companyId);
      return;
    }

    const cfg = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: { allowMultipleServices: true },
    });
    const multiService = cfg?.allowMultipleServices ?? false;

    // Multi-service: parse "1,3" or "1, 3" → índices
    if (multiService && trimmed.includes(',')) {
      const parts = trimmed.split(',').map((p) => parseInt(p.trim(), 10) - 1);
      const validIdxs = parts.filter((i) => !isNaN(i) && i >= 0 && i < services.length);

      if (validIdxs.length === 0) {
        await this.whatsapp.sendText(instanceName, rawNumber, 'Opção inválida. Tente novamente enviando os números separados por vírgula (ex: 1,3).');
        return;
      }

      const selectedServiceIds = validIdxs.map((i) => services[i]);
      // Para agendamento usa o primeiro serviço; os demais ficam salvos no contexto
      const selectedServiceId = selectedServiceIds[0];

      const svcNames = await this.prisma.service.findMany({
        where: { id: { in: selectedServiceIds } },
        select: { name: true },
      });
      const nameList = svcNames.map((s) => `• ${s.name}`).join('\n');
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        `✅ Serviços selecionados:\n${nameList}\n\nBuscando datas disponíveis...`,
      );

      await this.showAvailableDates(instanceName, rawNumber, companyId, {
        ...ctx,
        selectedServiceId,
        appointmentIds: selectedServiceIds, // reutilizamos appointmentIds para armazenar IDs dos serviços extras
      } as BookingContext);
      return;
    }

    // Single service selection
    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= services.length) {
      const svcRecords = await this.prisma.service.findMany({
        where: { companyId, id: { in: services }, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { name: 'asc' },
      });
      const lines = multiService
        ? ['*Escolha os serviços desejados:*', '', 'Digite os números separados por vírgula (ex: 1,3):', '']
        : ['*Escolha o serviço:*', ''];
      svcRecords.forEach((s, i) => {
        const price = Number(s.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        lines.push(`${i + 1} - ${s.name} • ${s.durationMinutes} min • ${price}`);
      });
      lines.push('', '0 - Voltar ao menu');
      lines.push('', 'Opção inválida. Tente novamente.');
      await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));
      return;
    }

    const selectedServiceId = services[idx];
    await this.showAvailableDates(instanceName, rawNumber, companyId, { ...ctx, selectedServiceId } as BookingContext);
  }

  private async showAvailableDates(
    instanceName: string,
    rawNumber: string,
    companyId: string,
    ctx: BookingContext,
  ): Promise<void> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 6); // next 7 days (today + 6)

    await this.whatsapp.sendText(instanceName, rawNumber, '⏳ Buscando datas disponíveis...');

    const dates = await this.scheduleEngine.getAvailableDatesInRange(
      companyId,
      ctx.selectedServiceId!,
      ctx.selectedCollaboratorId,
      now,
      endDate,
    );

    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const rangeLabel = `${fmtDate(now)} a ${fmtDate(endDate)}`;

    if (dates.length === 0) {
      const withQueue = await this.queueEnabled(companyId);
      if (withQueue) {
        await this.whatsapp.sendText(
          instanceName,
          rawNumber,
          `Nenhuma data disponível nos próximos 7 dias (${rangeLabel}).\n\nMas você pode entrar na fila de espera e ser chamado quando houver disponibilidade!\n\n1 - Entrar na fila\n0 - Voltar ao menu`,
        );
        await this.setState(companyId, rawNumber, 'NO_COLLABORATOR_QUEUE_OFFER');
      } else {
        await this.whatsapp.sendText(
          instanceName,
          rawNumber,
          `Nenhuma data disponível nos próximos 7 dias (${rangeLabel}). Entre em contato com o estabelecimento.`,
        );
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
      }
      return;
    }

    const lines = [`*Datas disponíveis — ${rangeLabel}:*`, ''];
    dates.forEach((d, i) => {
      const [y, m, day] = d.split('-').map(Number);
      const dateObj = new Date(y, m - 1, day);
      const dayName = DAY_NAMES_PT[dateObj.getDay()];
      const formatted = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      lines.push(`${i + 1} - ${formatted} (${dayName})`);
    });
    lines.push('', '0 - Voltar ao serviço');
    lines.push('', 'Digite o número da data desejada.');

    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));
    await this.setState(companyId, rawNumber, 'SELECT_DATE', {
      ...ctx,
      dates,
    } as BookingContext);
  }

  private async handleDateInput(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
  ): Promise<void> {
    const dates = ctx.dates ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      const svcRecords = await this.prisma.service.findMany({
        where: { companyId, id: { in: ctx.services ?? [] }, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { name: 'asc' },
      });
      const lines = ['*Escolha o serviço:*', ''];
      svcRecords.forEach((s, i) => {
        const price = Number(s.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        lines.push(`${i + 1} - ${s.name} • ${s.durationMinutes} min • ${price}`);
      });
      lines.push('', '0 - Voltar ao profissional');
      lines.push('', 'Digite o número do serviço desejado.');
      await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));
      await this.setState(companyId, rawNumber, 'SELECT_SERVICE', {
        collaborators: ctx.collaborators,
        selectedCollaboratorId: ctx.selectedCollaboratorId,
        services: ctx.services,
      } as BookingContext);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= dates.length) {
      await this.showAvailableDates(instanceName, rawNumber, companyId, ctx);
      return;
    }

    const dateStr = dates[idx];
    const allSlots = await this.scheduleEngine.getAvailableSlots(companyId, {
      date: dateStr,
      serviceId: ctx.selectedServiceId!,
      collaboratorId: ctx.selectedCollaboratorId,
    } as Parameters<ScheduleEngineService['getAvailableSlots']>[1]);

    const availableSlots = allSlots.filter((s) => s.available).slice(0, 8).map((s) => s.time);

    const [y, m, day] = dateStr.split('-').map(Number);
    const dateLabel = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

    if (availableSlots.length === 0) {
      await this.whatsapp.sendText(instanceName, rawNumber, `Nenhum horário disponível em ${dateLabel}. Escolha outra data:`);
      await this.showAvailableDates(instanceName, rawNumber, companyId, ctx);
      return;
    }

    const lines = [`*Horários disponíveis para ${dateLabel}:*`, ''];
    availableSlots.forEach((slot, i) => lines.push(`${i + 1} - ${slot}`));
    lines.push('', '0 - Voltar à data');
    lines.push('', 'Digite o número do horário desejado.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'SELECT_SLOT', {
      ...ctx,
      selectedDate: dateStr,
      slots: availableSlots,
    } as BookingContext);
  }

  private async handleSlotSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const slots = ctx.slots ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showAvailableDates(instanceName, rawNumber, companyId, ctx);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= slots.length) {
      const lines = [`*Horários disponíveis para ${ctx.selectedDate}:*`, ''];
      slots.forEach((slot, i) => lines.push(`${i + 1} - ${slot}`));
      lines.push('', '0 - Voltar à data');
      lines.push('', 'Opção inválida. Digite o número do horário desejado.');
      await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));
      return;
    }

    const selectedTime = slots[idx];

    // Resolve clientId
    let resolvedClientId = clientId;
    if (!resolvedClientId) {
      const newClient = await this.prisma.client.upsert({
        where: { companyId_whatsappNumber: { companyId, whatsappNumber: rawNumber } },
        create: { companyId, whatsappNumber: rawNumber, name: 'Cliente WhatsApp' },
        update: {},
      });
      resolvedClientId = newClient.id;
    }

    // Resolve collaboratorId — pode ser null quando skipCollaboratorSelection está ativo
    let resolvedCollaboratorId = ctx.selectedCollaboratorId ?? null;
    if (!resolvedCollaboratorId) {
      const fallback = await this.prisma.collaborator.findFirst({
        where: { companyId, isActive: true },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      if (!fallback) {
        await this.whatsapp.sendText(
          instanceName,
          rawNumber,
          'Nenhum profissional disponível para realizar o agendamento. Entre em contato com o estabelecimento.',
        );
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
        return;
      }
      resolvedCollaboratorId = fallback.id;
    }

    const [service, collaborator] = await Promise.all([
      this.prisma.service.findUnique({
        where: { id: ctx.selectedServiceId! },
        select: { name: true, durationMinutes: true },
      }),
      this.prisma.collaborator.findUnique({
        where: { id: resolvedCollaboratorId },
        select: { name: true },
      }),
    ]);

    const endTime = minutesToTime(
      timeToMinutes(selectedTime) + (service?.durationMinutes ?? 30),
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            companyId,
            collaboratorId: resolvedCollaboratorId!,
            scheduledDate: new Date(ctx.selectedDate!),
            scheduledTime: selectedTime,
            status: { notIn: [AppointmentStatus.CANCELLED] },
          },
        });
        if (conflict) throw new Error('SLOT_TAKEN');
        await tx.appointment.create({
          data: {
            companyId,
            clientId: resolvedClientId!,
            collaboratorId: resolvedCollaboratorId!,
            serviceId: ctx.selectedServiceId!,
            scheduledDate: new Date(ctx.selectedDate! + 'T00:00:00.000Z'),
            scheduledTime: selectedTime,
            endTime,
            status: AppointmentStatus.SCHEDULED,
            createdViaBot: true,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Não foi possível criar o agendamento. O horário pode ter sido reservado. Tente novamente.',
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const dateFormatted = ctx.selectedDate!.split('-').reverse().join('/');
    const confirmation = [
      '✅ *Agendamento confirmado!*',
      '',
      `📅 Data: ${dateFormatted}`,
      `🕐 Horário: ${selectedTime}`,
      `💈 Serviço: ${service?.name ?? ''}`,
      `👤 Profissional: ${collaborator?.name ?? 'A definir'}`,
      '',
      'Envie qualquer mensagem para acessar o menu.',
    ].join('\n');

    await this.whatsapp.sendText(instanceName, rawNumber, confirmation);
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  // ─── Option 4: queue join ─────────────────────────────────────────────────

  private async startQueueFlow(
    instanceName: string,
    rawNumber: string,
    companyId: string,
  ): Promise<void> {
    if (!(await this.queueEnabled(companyId))) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Fila de espera não disponível neste estabelecimento.',
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const services = await this.prisma.service.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (services.length === 0) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Nenhum serviço disponível no momento.',
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const lines = ['*Escolha o serviço para entrar na fila:*', ''];
    services.forEach((s, i) => lines.push(`${i + 1} - ${s.name}`));
    lines.push('', '0 - Voltar ao menu');
    lines.push('', 'Digite o número do serviço desejado.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'SELECT_QUEUE_SERVICE', {
      services: services.map((s) => s.id),
    } as BookingContext);
  }

  private async handleQueueServiceSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const services = ctx.services ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showMainMenu(instanceName, rawNumber, companyId);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= services.length) {
      await this.startQueueFlow(instanceName, rawNumber, companyId);
      return;
    }

    const selectedServiceId = services[idx];

    let resolvedClientId = clientId;
    if (!resolvedClientId) {
      const newClient = await this.prisma.client.upsert({
        where: { companyId_whatsappNumber: { companyId, whatsappNumber: rawNumber } },
        create: { companyId, whatsappNumber: rawNumber, name: 'Cliente WhatsApp' },
        update: {},
      });
      resolvedClientId = newClient.id;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.queueEntry.findFirst({
      where: {
        companyId,
        clientId: resolvedClientId,
        status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        joinedAt: { gte: today },
      },
    });

    if (existing) {
      const waitingAhead = await this.prisma.queueEntry.count({
        where: {
          companyId,
          status: QueueStatus.WAITING,
          position: { lt: existing.position },
          joinedAt: { gte: today },
        },
      });
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        [
          'Você já está na fila!',
          `*Posição:* ${existing.position}`,
          `*Pessoas à sua frente:* ${waitingAhead}`,
          `*Tempo estimado:* ~${waitingAhead * 30} minutos`,
        ].join('\n'),
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const service = await this.prisma.service.findUnique({
      where: { id: selectedServiceId },
      select: { name: true, durationMinutes: true },
    });

    const createdEntry = await this.prisma.$transaction(async (tx) => {
      const maxResult = await tx.queueEntry.aggregate({
        where: {
          companyId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
          joinedAt: { gte: today },
        },
        _max: { position: true },
      });
      const nextPosition = (maxResult._max.position ?? 0) + 1;
      return tx.queueEntry.create({
        data: {
          companyId,
          clientId: resolvedClientId,
          serviceId: selectedServiceId,
          priority: QueuePriority.NORMAL,
          position: nextPosition,
          createdViaBot: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const nextPosition = createdEntry.position;

    const waitingAhead = await this.prisma.queueEntry.count({
      where: {
        companyId,
        status: QueueStatus.WAITING,
        position: { lt: nextPosition },
        joinedAt: { gte: today },
      },
    });

    const avgDuration = service?.durationMinutes ?? 30;
    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      [
        '✅ *Você entrou na fila!*',
        '',
        `💈 Serviço: ${service?.name ?? ''}`,
        `*Posição:* ${nextPosition}`,
        `*Pessoas à sua frente:* ${waitingAhead}`,
        `*Tempo estimado:* ~${waitingAhead * avgDuration} minutos`,
        '',
        'Aguarde ser chamado.',
      ].join('\n'),
    );
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  // ─── Option 3: cancel appointment ────────────────────────────────────────

  private async startCancelFlow(
    instanceName: string,
    rawNumber: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    if (!clientId) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Você não possui agendamentos para cancelar.');
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        clientId,
        scheduledDate: { gte: today },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] },
      },
      include: {
        service: { select: { name: true } },
        collaborator: { select: { name: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      take: 5,
    });

    if (appointments.length === 0) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Você não possui agendamentos para cancelar.');
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const lines = ['*Qual agendamento deseja cancelar?*', ''];
    appointments.forEach((a, i) => {
      const date = a.scheduledDate.toISOString().split('T')[0].split('-').reverse().join('/');
      lines.push(`${i + 1} - ${date} ${a.scheduledTime} - ${a.service.name} - ${a.collaborator.name}`);
    });
    lines.push('', '0 - Voltar ao menu');
    lines.push('', 'Digite o número do agendamento que deseja cancelar.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'LIST_CANCELABLE', {
      appointmentIds: appointments.map((a) => a.id),
    } as BookingContext);
  }

  private async handleCancellationSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: BookingContext,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    if (!clientId) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Você não possui agendamentos para cancelar.');
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const appointmentIds = ctx.appointmentIds ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showMainMenu(instanceName, rawNumber, companyId);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= appointmentIds.length) {
      await this.startCancelFlow(instanceName, rawNumber, companyId, clientId);
      return;
    }

    const appointmentId = appointmentIds[idx];

    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, clientId },
      include: {
        service: { select: { name: true } },
        collaborator: { select: { name: true } },
      },
    });

    if (!appt) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Agendamento não encontrado.');
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const cancellable = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
    if (!(cancellable as string[]).includes(appt.status)) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        `Não é possível cancelar agendamento com status "${STATUS_LABEL[appt.status] ?? appt.status}".`,
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    const rules = await this.prisma.businessRules.findUnique({ where: { companyId } });

    if (rules?.cancellationAllowed === false) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Cancelamento não permitido neste estabelecimento. Entre em contato diretamente.',
      );
      await this.setState(companyId, rawNumber, 'MAIN_MENU');
      return;
    }

    if (rules?.cancellationMinHours) {
      const dateStr = appt.scheduledDate.toISOString().split('T')[0];
      const appointmentDateTime = new Date(`${dateStr}T${appt.scheduledTime}:00`);
      const minutesUntil = differenceInMinutes(appointmentDateTime, new Date());
      if (minutesUntil < rules.cancellationMinHours * 60) {
        const timeLeft =
          minutesUntil < 60
            ? `${minutesUntil} minuto${minutesUntil !== 1 ? 's' : ''}`
            : `${Math.floor(minutesUntil / 60)} hora${Math.floor(minutesUntil / 60) !== 1 ? 's' : ''}`;
        await this.whatsapp.sendText(
          instanceName,
          rawNumber,
          `Cancelamento não permitido. O estabelecimento exige ${rules.cancellationMinHours}h de antecedência e faltam apenas ${timeLeft} para o seu horário.`,
        );
        await this.setState(companyId, rawNumber, 'MAIN_MENU');
        return;
      }
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: 'Cancelado pelo cliente via WhatsApp',
      },
    });

    const dateFormatted = appt.scheduledDate
      .toISOString()
      .split('T')[0]
      .split('-')
      .reverse()
      .join('/');

    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      [
        '✅ *Agendamento cancelado!*',
        '',
        `📅 ${dateFormatted} às ${appt.scheduledTime}`,
        `💈 ${appt.service.name} com ${appt.collaborator.name}`,
      ].join('\n'),
    );
    await this.setState(companyId, rawNumber, 'MAIN_MENU');
  }

  // ─── Option 2: view appointments ─────────────────────────────────────────

  private async handleViewAppointments(
    instanceName: string,
    rawNumber: string,
    clientId: string,
    companyId: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        clientId,
        scheduledDate: { gte: today },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] },
      },
      include: {
        service: { select: { name: true } },
        collaborator: { select: { name: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      take: 5,
    });

    if (appointments.length === 0) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Você não possui agendamentos futuros.',
      );
      return;
    }

    const lines = ['*Seus próximos agendamentos:*', ''];
    for (const appt of appointments) {
      const date = appt.scheduledDate.toISOString().split('T')[0].split('-').reverse().join('/');
      lines.push(
        `📅 ${date} às ${appt.scheduledTime}`,
        `   Serviço: ${appt.service.name}`,
        `   Profissional: ${appt.collaborator.name}`,
        `   Status: ${STATUS_LABEL[appt.status] ?? appt.status}`,
        '',
      );
    }
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n').trimEnd());
  }

  // ─── Option 5: queue position ─────────────────────────────────────────────

  private async handleQueuePosition(
    instanceName: string,
    rawNumber: string,
    clientId: string,
    companyId: string,
  ): Promise<void> {
    if (!(await this.queueEnabled(companyId))) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Função em implementação.');
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        companyId,
        clientId,
        status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        joinedAt: { gte: today },
      },
      include: { service: { select: { durationMinutes: true } } },
    });

    if (!entry) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Você não está na fila no momento.');
      return;
    }

    const waitingAhead = await this.prisma.queueEntry.count({
      where: {
        companyId,
        status: QueueStatus.WAITING,
        position: { lt: entry.position },
        joinedAt: { gte: today },
      },
    });

    const avgDuration = entry.service?.durationMinutes ?? 30;
    const estimatedWait = waitingAhead * avgDuration;

    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      [
        `*Sua posição na fila:* ${entry.position}`,
        `*Pessoas à sua frente:* ${waitingAhead}`,
        `*Tempo estimado:* ~${estimatedWait} minutos`,
      ].join('\n'),
    );
  }
}
