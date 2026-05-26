import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { QueueGateway } from './queue.gateway';
import {
  AuditAction,
  NotificationType,
  type QueueEntryPublic,
  type QueueState,
} from '@agendaflow/shared';
import {
  QueueStatus,
  QueuePriority,
  type QueueEntry,
  type Collaborator,
  type Client,
  type Service,
} from '@prisma/client';
import { JoinQueueDto } from './dto/join-queue.dto';
import { ReorderQueueDto } from './dto/reorder-queue.dto';

type QueueEntryFull = QueueEntry & {
  client: Client;
  collaborator: Collaborator | null;
  service: Service | null;
};

const ACTIVE_STATUSES = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE];

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly gateway: QueueGateway,
  ) {}

  private toPublic(entry: QueueEntryFull, estimatedWait?: number): QueueEntryPublic {
    return {
      id: entry.id,
      clientName: entry.client.name,
      clientWhatsapp: entry.client.whatsappNumber,
      collaboratorName: entry.collaborator?.name,
      serviceName: entry.service?.name,
      status: entry.status as unknown as QueueEntryPublic['status'],
      priority: entry.priority as unknown as QueueEntryPublic['priority'],
      position: entry.position,
      estimatedWaitMinutes: estimatedWait ?? entry.estimatedWait ?? undefined,
      joinedAt: entry.joinedAt.toISOString(),
      calledAt: entry.calledAt?.toISOString(),
    };
  }

  private async buildQueueState(companyId: string): Promise<QueueState> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const entries = await this.prisma.queueEntry.findMany({
      where: { companyId, status: { in: ACTIVE_STATUSES }, joinedAt: { gte: today } },
      include: {
        client: true,
        collaborator: true,
        service: true,
      },
      orderBy: [
        { priority: 'desc' },
        { position: 'asc' },
      ],
    });

    const waiting = entries.filter((e) => e.status === QueueStatus.WAITING);
    const avgServiceDuration =
      entries.reduce((sum, e) => sum + (e.service?.durationMinutes ?? 30), 0) /
      Math.max(entries.length, 1);

    const publicEntries: QueueEntryPublic[] = entries.map((entry) => {
      const waitingBefore = waiting.filter((w) => w.position < entry.position).length;
      const estimatedWait = Math.round(waitingBefore * avgServiceDuration);
      return this.toPublic(entry as QueueEntryFull, estimatedWait);
    });

    return {
      companyId,
      entries: publicEntries,
      totalWaiting: waiting.length,
      averageWaitMinutes: Math.round(avgServiceDuration),
      updatedAt: new Date().toISOString(),
    };
  }

  async getState(companyId: string): Promise<QueueState> {
    return this.buildQueueState(companyId);
  }

  async joinQueue(companyId: string, dto: JoinQueueDto, userId?: string): Promise<QueueEntryPublic> {
    const client = await this.prisma.client.findFirst({ where: { companyId, id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.isBlocked) throw new BadRequestException('Cliente está bloqueado');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const alreadyInQueue = await this.prisma.queueEntry.findFirst({
      where: {
        companyId,
        clientId: dto.clientId,
        status: { in: ACTIVE_STATUSES },
        joinedAt: { gte: today },
      },
    });
    if (alreadyInQueue) throw new BadRequestException('Cliente já está na fila');

    const maxPositionResult = await this.prisma.queueEntry.aggregate({
      where: { companyId, status: { in: ACTIVE_STATUSES }, joinedAt: { gte: today } },
      _max: { position: true },
    });

    const nextPosition = (maxPositionResult._max.position ?? 0) + 1;

    const entry = await this.prisma.queueEntry.create({
      data: {
        companyId,
        clientId: dto.clientId,
        serviceId: dto.serviceId,
        collaboratorId: dto.collaboratorId,
        priority: dto.priority ?? QueuePriority.NORMAL,
        position: nextPosition,
        notes: dto.notes,
      },
      include: { client: true, collaborator: true, service: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.QUEUE_JOINED,
      entity: 'QueueEntry',
      entityId: entry.id,
      newValue: { clientId: dto.clientId, position: nextPosition },
    });

    const publicEntry = this.toPublic(entry as QueueEntryFull);
    this.gateway.emitQueueJoined(companyId, publicEntry);

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);

    return publicEntry;
  }

  async callNext(companyId: string, collaboratorId?: string, userId?: string): Promise<QueueEntryPublic> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const where: Prisma.QueueEntryWhereInput = {
      companyId,
      status: QueueStatus.WAITING,
      joinedAt: { gte: today },
      ...(collaboratorId ? { collaboratorId } : {}),
    };

    const next = await this.prisma.queueEntry.findFirst({
      where,
      include: { client: true, collaborator: true, service: true },
      orderBy: [{ priority: 'desc' }, { position: 'asc' }],
    });

    if (!next) throw new NotFoundException('Nenhum cliente aguardando na fila');

    const updated = await this.prisma.queueEntry.update({
      where: { id: next.id },
      data: { status: QueueStatus.CALLED, calledAt: new Date() },
      include: { client: true, collaborator: true, service: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.QUEUE_CALLED,
      entity: 'QueueEntry',
      entityId: next.id,
      newValue: { clientId: next.clientId },
    });

    const whatsappConfig = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (whatsappConfig?.isConnected) {
      const message =
        whatsappConfig.queueCalledMessage ??
        `${next.client.name}, é a sua vez! Por favor, dirija-se ao atendimento.`;
      await this.notifications.enqueueWhatsapp({
        companyId,
        instanceName: whatsappConfig.instanceName,
        toNumber: next.client.whatsappNumber,
        message,
        type: NotificationType.QUEUE_CALLED,
        clientId: next.clientId,
      }, 1);
    }

    const publicEntry = this.toPublic(updated as QueueEntryFull);
    this.gateway.emitQueueCalled(companyId, publicEntry);

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);

    return publicEntry;
  }

  async startService(companyId: string, entryId: string, userId: string): Promise<QueueEntryPublic> {
    const entry = await this.prisma.queueEntry.findFirst({ where: { companyId, id: entryId } });
    if (!entry) throw new NotFoundException('Entrada na fila não encontrada');
    if (entry.status !== QueueStatus.CALLED) {
      throw new BadRequestException('Apenas entradas com status CALLED podem iniciar atendimento');
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: QueueStatus.IN_SERVICE, serviceStartAt: new Date() },
      include: { client: true, collaborator: true, service: true },
    });

    const publicEntry = this.toPublic(updated as QueueEntryFull);
    this.gateway.emitQueueUpdated(companyId, publicEntry);

    return publicEntry;
  }

  async finishService(companyId: string, entryId: string, userId: string): Promise<QueueEntryPublic> {
    const entry = await this.prisma.queueEntry.findFirst({ where: { companyId, id: entryId } });
    if (!entry) throw new NotFoundException('Entrada na fila não encontrada');
    if (entry.status !== QueueStatus.IN_SERVICE) {
      throw new BadRequestException('Apenas entradas em atendimento podem ser finalizadas');
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: QueueStatus.DONE, completedAt: new Date() },
      include: { client: true, collaborator: true, service: true },
    });

    await Promise.all([
      this.prisma.client.update({
        where: { id: entry.clientId },
        data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
      }),
      this.audit.log({
        companyId,
        userId,
        action: AuditAction.QUEUE_COMPLETED,
        entity: 'QueueEntry',
        entityId: entryId,
      }),
    ]);

    const publicEntry = this.toPublic(updated as QueueEntryFull);
    this.gateway.emitQueueUpdated(companyId, publicEntry);

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);

    return publicEntry;
  }

  async leaveQueue(companyId: string, entryId: string, userId?: string): Promise<void> {
    const entry = await this.prisma.queueEntry.findFirst({ where: { companyId, id: entryId } });
    if (!entry) throw new NotFoundException('Entrada na fila não encontrada');

    await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: QueueStatus.LEFT, leftAt: new Date() },
    });

    this.gateway.emitQueueLeft(companyId, entryId);

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);
  }

  async completeEntry(companyId: string, entryId: string, userId: string): Promise<QueueEntryPublic> {
    const entry = await this.prisma.queueEntry.findFirst({ where: { companyId, id: entryId } });
    if (!entry) throw new NotFoundException('Entrada na fila não encontrada');
    if (entry.status === QueueStatus.DONE || entry.status === QueueStatus.LEFT) {
      throw new BadRequestException('Entrada não está ativa na fila');
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: QueueStatus.DONE, completedAt: new Date() },
      include: { client: true, collaborator: true, service: true },
    });

    await Promise.all([
      this.prisma.client.update({
        where: { id: entry.clientId },
        data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
      }),
      this.audit.log({
        companyId,
        userId,
        action: AuditAction.QUEUE_COMPLETED,
        entity: 'QueueEntry',
        entityId: entryId,
      }),
    ]);

    const publicEntry = this.toPublic(updated as QueueEntryFull);
    this.gateway.emitQueueUpdated(companyId, publicEntry);

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);

    return publicEntry;
  }

  async reorderQueue(companyId: string, dto: ReorderQueueDto, userId: string): Promise<QueueState> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const entries = await this.prisma.queueEntry.findMany({
      where: {
        companyId,
        id: { in: dto.orderedIds },
        status: QueueStatus.WAITING,
        joinedAt: { gte: today },
      },
    });

    if (entries.length !== dto.orderedIds.length) {
      throw new BadRequestException('Algumas entradas não foram encontradas ou não estão em espera');
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.queueEntry.update({
          where: { id },
          data: { position: index + 1 },
        }),
      ),
    );

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.QUEUE_JOINED,
      entity: 'QueueEntry',
      entityId: companyId,
      newValue: { reordered: dto.orderedIds },
    });

    const state = await this.buildQueueState(companyId);
    this.gateway.emitQueueState(companyId, state);
    return state;
  }
}
