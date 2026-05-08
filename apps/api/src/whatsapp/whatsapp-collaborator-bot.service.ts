import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { AppointmentStatus, QueueStatus, Prisma, type ConversationState } from '@prisma/client';

const CONVERSATION_TTL_MS = 30 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

interface CollabContext {
  appointmentIds?: string[];
  selectedAppointmentId?: string;
}

function conversationExpiresAt(): Date {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

@Injectable()
export class WhatsappCollaboratorBotService {
  private readonly logger = new Logger(WhatsappCollaboratorBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

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

  async handle(
    instanceName: string,
    rawNumber: string,
    messageText: string,
    collaborator: { id: string; name: string },
    state: ConversationState,
    companyId: string,
  ): Promise<void> {
    const step = state.currentStep;

    if (step === 'COLLAB_FINISH_LIST') {
      const ctx = (state.context ?? {}) as CollabContext;
      await this.handleFinishSelection(instanceName, rawNumber, messageText, ctx, companyId, collaborator);
      return;
    }

    if (step === 'COLLAB_TODAY_LIST') {
      const ctx = (state.context ?? {}) as CollabContext;
      await this.handleTodaySelection(instanceName, rawNumber, messageText, ctx, companyId, collaborator);
      return;
    }

    if (step === 'COLLAB_APPT_ACTION') {
      const ctx = (state.context ?? {}) as CollabContext;
      await this.handleApptAction(instanceName, rawNumber, messageText, ctx, companyId, collaborator);
      return;
    }

    if (step === 'COLLAB_MENU') {
      await this.handleMenuReply(instanceName, rawNumber, messageText, collaborator, companyId);
      return;
    }

    await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
  }

  private async showMenu(
    instanceName: string,
    rawNumber: string,
    collaboratorName: string,
    companyId: string,
  ): Promise<void> {
    const menu = [
      `Olá, ${collaboratorName}! *Menu de atendimento*`,
      '',
      '1 - Ver agenda de hoje',
      '2 - Chamar próximo da fila',
      '3 - Finalizar atendimento',
      '',
      'Digite o número da opção desejada.',
    ].join('\n');

    await this.whatsapp.sendText(instanceName, rawNumber, menu);
    await this.setState(companyId, rawNumber, 'COLLAB_MENU');
  }

  private async handleMenuReply(
    instanceName: string,
    rawNumber: string,
    messageText: string,
    collaborator: { id: string; name: string },
    companyId: string,
  ): Promise<void> {
    const option = messageText.trim().match(/^(\d)/)?.[1] ?? '';

    switch (option) {
      case '1':
        await this.handleTodaySchedule(instanceName, rawNumber, collaborator.id, companyId);
        break;
      case '2':
        await this.handleCallNext(instanceName, rawNumber, collaborator.id, companyId);
        await this.setState(companyId, rawNumber, 'COLLAB_MENU');
        break;
      case '3':
        await this.startFinishFlow(instanceName, rawNumber, collaborator.id, companyId);
        break;
      default:
        await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
    }
  }

  private async handleTodaySchedule(
    instanceName: string,
    rawNumber: string,
    collaboratorId: string,
    companyId: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        collaboratorId,
        scheduledDate: { gte: today, lt: tomorrow },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
        },
      },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    if (appointments.length === 0) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Nenhum agendamento para hoje.');
      return;
    }

    const lines = ['*Agenda de hoje:*', ''];
    appointments.forEach((a, i) => {
      lines.push(`${i + 1} - ${a.scheduledTime} - ${a.client.name} - ${a.service.name} - ${STATUS_LABEL[a.status] ?? a.status}`);
    });
    lines.push('', '0 - Voltar ao menu');
    lines.push('', 'Selecione o número para ver opções do agendamento.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'COLLAB_TODAY_LIST', {
      appointmentIds: appointments.map((a) => a.id),
    });
  }

  private async handleTodaySelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: CollabContext,
    companyId: string,
    collaborator: { id: string; name: string },
  ): Promise<void> {
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
      return;
    }

    const appointmentIds = ctx.appointmentIds ?? [];
    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= appointmentIds.length) {
      await this.handleTodaySchedule(instanceName, rawNumber, collaborator.id, companyId);
      return;
    }

    const appointmentId = appointmentIds[idx];
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    if (!appt) {
      await this.handleTodaySchedule(instanceName, rawNumber, collaborator.id, companyId);
      return;
    }

    const lines = [
      `*${appt.scheduledTime} - ${appt.client.name}*`,
      `Serviço: ${appt.service.name}`,
      `Status: ${STATUS_LABEL[appt.status] ?? appt.status}`,
      '',
      '1 - Concluir atendimento',
      '2 - Cancelar agendamento',
      '3 - Cliente não compareceu',
      '',
      '0 - Voltar à agenda',
    ];
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'COLLAB_APPT_ACTION', {
      appointmentIds: ctx.appointmentIds,
      selectedAppointmentId: appointmentId,
    });
  }

  private async handleApptAction(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: CollabContext,
    companyId: string,
    collaborator: { id: string; name: string },
  ): Promise<void> {
    const trimmed = text.trim();
    const appointmentId = ctx.selectedAppointmentId;

    if (trimmed === '0') {
      await this.setState(companyId, rawNumber, 'COLLAB_TODAY_LIST', {
        appointmentIds: ctx.appointmentIds,
      });
      await this.handleTodaySchedule(instanceName, rawNumber, collaborator.id, companyId);
      return;
    }

    if (!appointmentId) {
      await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
      return;
    }

    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, collaboratorId: collaborator.id },
      include: { client: { select: { name: true } }, service: { select: { name: true } } },
    });

    if (!appt) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Agendamento não encontrado.');
      await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
      return;
    }

    let newStatus: AppointmentStatus | null = null;
    let confirmMsg = '';

    if (trimmed === '1') {
      newStatus = AppointmentStatus.COMPLETED;
      confirmMsg = `✅ *Atendimento concluído!*\n\n👤 ${appt.client.name}\n💈 ${appt.service.name}\n🕐 ${appt.scheduledTime}`;
    } else if (trimmed === '2') {
      newStatus = AppointmentStatus.CANCELLED;
      confirmMsg = `❌ *Agendamento cancelado.*\n\n👤 ${appt.client.name}\n💈 ${appt.service.name}\n🕐 ${appt.scheduledTime}`;
    } else if (trimmed === '3') {
      newStatus = AppointmentStatus.NO_SHOW;
      confirmMsg = `⚠️ *Cliente não compareceu registrado.*\n\n👤 ${appt.client.name}\n💈 ${appt.service.name}\n🕐 ${appt.scheduledTime}`;
    } else {
      // Invalid — re-show action menu
      await this.handleTodaySelection(instanceName, rawNumber, String((ctx.appointmentIds?.indexOf(appointmentId) ?? 0) + 1), { appointmentIds: ctx.appointmentIds }, companyId, collaborator);
      return;
    }

    const updateData: Parameters<typeof this.prisma.appointment.update>[0]['data'] = {
      status: newStatus,
    };
    if (newStatus === AppointmentStatus.COMPLETED) updateData.completedAt = new Date();

    await this.prisma.appointment.update({ where: { id: appointmentId }, data: updateData });

    // If completing, also close linked queue entry
    if (newStatus === AppointmentStatus.COMPLETED) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const linkedQueue = await this.prisma.queueEntry.findFirst({
        where: {
          companyId,
          clientId: appt.clientId,
          status: { in: [QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
          joinedAt: { gte: today },
        },
      });
      if (linkedQueue) {
        await this.prisma.queueEntry.update({
          where: { id: linkedQueue.id },
          data: { status: QueueStatus.DONE, completedAt: new Date() },
        });
      }
    }

    await this.whatsapp.sendText(instanceName, rawNumber, confirmMsg);
    await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
  }

  private async handleCallNext(
    instanceName: string,
    rawNumber: string,
    collaboratorId: string,
    companyId: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    type CalledInfo = { clientName: string; clientPhone: string; serviceName: string };

    let called: CalledInfo | null;
    try {
      called = await this.prisma.$transaction(async (tx) => {
        const next = await tx.queueEntry.findFirst({
          where: { companyId, status: QueueStatus.WAITING, joinedAt: { gte: today } },
          include: {
            client: { select: { name: true, whatsappNumber: true } },
            service: { select: { name: true } },
          },
          orderBy: [{ priority: 'desc' }, { position: 'asc' }],
        });
        if (!next) return null;
        const lock = await tx.queueEntry.updateMany({
          where: { id: next.id, status: QueueStatus.WAITING },
          data: { status: QueueStatus.CALLED, calledAt: new Date(), collaboratorId },
        });
        if (lock.count === 0) return null;

        // Transition matching appointment to IN_PROGRESS automatically
        await tx.appointment.updateMany({
          where: {
            companyId,
            collaboratorId,
            clientId: next.clientId,
            scheduledDate: { gte: today, lt: tomorrow },
            status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          },
          data: { status: AppointmentStatus.IN_PROGRESS },
        });

        return {
          clientName: next.client.name,
          clientPhone: next.client.whatsappNumber,
          serviceName: next.service?.name ?? '',
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Erro ao chamar próximo. Tente novamente.');
      return;
    }

    if (!called) {
      await this.whatsapp.sendText(instanceName, rawNumber, 'Nenhum cliente aguardando na fila.');
      return;
    }

    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      `✅ Chamando: *${called.clientName}* — Serviço: ${called.serviceName}`,
    );

    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (config?.isConnected && called.clientPhone) {
      const clientMsg =
        config.queueCalledMessage ??
        `${called.clientName}, é a sua vez! Por favor, dirija-se ao atendimento.`;
      await this.whatsapp.sendText(instanceName, called.clientPhone, clientMsg);
    }
  }

  private async startFinishFlow(
    instanceName: string,
    rawNumber: string,
    collaboratorId: string,
    companyId: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        collaboratorId,
        scheduledDate: { gte: today, lt: tomorrow },
        status: AppointmentStatus.IN_PROGRESS,
      },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    if (appointments.length === 0) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Nenhum atendimento em andamento no momento.',
      );
      await this.setState(companyId, rawNumber, 'COLLAB_MENU');
      return;
    }

    const lines = ['*Qual atendimento deseja finalizar?*', ''];
    appointments.forEach((a, i) => {
      lines.push(`${i + 1} - ${a.scheduledTime} - ${a.client.name} - ${a.service.name}`);
    });
    lines.push('', '0 - Voltar ao menu');
    lines.push('', 'Digite o número do atendimento.');
    await this.whatsapp.sendText(instanceName, rawNumber, lines.join('\n'));

    await this.setState(companyId, rawNumber, 'COLLAB_FINISH_LIST', {
      appointmentIds: appointments.map((a) => a.id),
    });
  }

  private async handleFinishSelection(
    instanceName: string,
    rawNumber: string,
    text: string,
    ctx: CollabContext,
    companyId: string,
    collaborator: { id: string; name: string },
  ): Promise<void> {
    const collaboratorId = collaborator.id;
    const appointmentIds = ctx.appointmentIds ?? [];
    const trimmed = text.trim();

    if (trimmed === '0') {
      await this.showMenu(instanceName, rawNumber, collaborator.name, companyId);
      return;
    }

    const idx = parseInt(trimmed, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= appointmentIds.length) {
      await this.startFinishFlow(instanceName, rawNumber, collaboratorId, companyId);
      return;
    }

    const appointmentId = appointmentIds[idx];

    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, collaboratorId },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    if (!appt || appt.status !== AppointmentStatus.IN_PROGRESS) {
      await this.whatsapp.sendText(
        instanceName,
        rawNumber,
        'Agendamento não encontrado ou não está em andamento.',
      );
      await this.setState(companyId, rawNumber, 'COLLAB_MENU');
      return;
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED, completedAt: new Date() },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const linkedQueue = await this.prisma.queueEntry.findFirst({
      where: {
        companyId,
        clientId: appt.clientId,
        status: { in: [QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
        joinedAt: { gte: today },
      },
    });

    if (linkedQueue) {
      await this.prisma.queueEntry.update({
        where: { id: linkedQueue.id },
        data: { status: QueueStatus.DONE, completedAt: new Date() },
      });
    }

    await this.whatsapp.sendText(
      instanceName,
      rawNumber,
      [
        '✅ *Atendimento finalizado!*',
        '',
        `👤 ${appt.client.name}`,
        `💈 ${appt.service.name}`,
        `🕐 ${appt.scheduledTime}`,
      ].join('\n'),
    );

    await this.setState(companyId, rawNumber, 'COLLAB_MENU');
  }
}
