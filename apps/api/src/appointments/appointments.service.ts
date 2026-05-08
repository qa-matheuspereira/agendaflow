import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { ScheduleEngineService } from '@/schedule-engine/schedule-engine.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { ClientsService } from '@/clients/clients.service';
import { AuditAction, NotificationType } from '@agendaflow/shared';
import { AppointmentStatus } from '@prisma/client';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { PaginationDto, paginate } from '@/core/dto/pagination.dto';
import { differenceInHours } from 'date-fns';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function dateRange(dateStr: string) {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T00:00:00.000Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scheduleEngine: ScheduleEngineService,
    private readonly notifications: NotificationsService,
    private readonly clientsService: ClientsService,
  ) {}

  async create(companyId: string, dto: CreateAppointmentDto, userId: string) {
    const [service, client, collaborator] = await Promise.all([
      this.prisma.service.findFirst({ where: { companyId, id: dto.serviceId, isActive: true } }),
      this.prisma.client.findFirst({ where: { companyId, id: dto.clientId } }),
      this.prisma.collaborator.findFirst({ where: { companyId, id: dto.collaboratorId, isActive: true } }),
    ]);

    if (!service) throw new NotFoundException('Serviço não encontrado ou inativo');
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.isBlocked) throw new BadRequestException('Cliente está bloqueado e não pode agendar');
    if (!collaborator) throw new NotFoundException('Colaborador não encontrado ou inativo');

    const endTime = minutesToTime(timeToMinutes(dto.scheduledTime) + service.durationMinutes);

    let lockKey: string | null = null;
    if (!dto.skipLock) {
      lockKey = await this.scheduleEngine.acquireBookingLock(
        companyId,
        dto.collaboratorId,
        dto.scheduledDate,
        dto.scheduledTime,
      );
      if (!lockKey) {
        throw new ConflictException('Horário sendo reservado por outro usuário. Tente novamente.');
      }
    }

    try {
      await this.scheduleEngine.validateSlot(
        companyId,
        dto.collaboratorId,
        dto.serviceId,
        dto.scheduledDate,
        dto.scheduledTime,
      );

      const appointment = await this.prisma.appointment.create({
        data: {
          companyId,
          clientId: dto.clientId,
          collaboratorId: dto.collaboratorId,
          serviceId: dto.serviceId,
          scheduledDate: new Date(dto.scheduledDate),
          scheduledTime: dto.scheduledTime,
          endTime,
          notes: dto.notes,
          status: AppointmentStatus.SCHEDULED,
        },
        include: {
          client: { select: { name: true, whatsappNumber: true } },
          collaborator: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      await this.audit.log({
        companyId,
        userId,
        action: AuditAction.APPOINTMENT_CREATED,
        entity: 'Appointment',
        entityId: appointment.id,
        newValue: {
          clientId: dto.clientId,
          collaboratorId: dto.collaboratorId,
          date: dto.scheduledDate,
          time: dto.scheduledTime,
        },
      });

      const whatsappConfig = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
      if (whatsappConfig?.isConnected) {
        const message =
          whatsappConfig.scheduleConfirmMsg ??
          `Olá ${appointment.client.name}! Agendamento confirmado: ${appointment.service.name} com ${appointment.collaborator.name} em ${dto.scheduledDate} às ${dto.scheduledTime}.`;
        await this.notifications.enqueueWhatsapp({
          companyId,
          instanceName: whatsappConfig.instanceName,
          toNumber: appointment.client.whatsappNumber,
          message,
          type: NotificationType.APPOINTMENT_CONFIRMED,
          clientId: dto.clientId,
        });
      }

      return appointment;
    } finally {
      if (lockKey) await this.scheduleEngine.releaseBookingLock(lockKey);
    }
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: {
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      collaboratorId?: string;
      clientId?: string;
      status?: AppointmentStatus;
    },
  ) {
    const where: Record<string, unknown> = { companyId };

    if (filters?.date) {
      where['scheduledDate'] = dateRange(filters.date);
    } else {
      const dateFilter: Record<string, Date> = {};
      if (filters?.dateFrom) dateFilter['gte'] = new Date(filters.dateFrom);
      if (filters?.dateTo) {
        const end = new Date(filters.dateTo);
        end.setDate(end.getDate() + 1);
        dateFilter['lt'] = end;
      }
      if (Object.keys(dateFilter).length > 0) where['scheduledDate'] = dateFilter;
    }

    if (filters?.collaboratorId) where['collaboratorId'] = filters.collaboratorId;
    if (filters?.clientId) where['clientId'] = filters.clientId;
    if (filters?.status) where['status'] = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, whatsappNumber: true } },
          collaborator: { select: { id: true, name: true } },
          service: { select: { id: true, name: true, durationMinutes: true } },
          payment: { select: { status: true, amount: true } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    const mapped = data.map((appt) => ({
      id: appt.id,
      clientName: appt.client?.name ?? 'Desconhecido',
      clientWhatsapp: appt.client?.whatsappNumber ?? '',
      collaboratorName: appt.collaborator?.name ?? '',
      serviceName: appt.service?.name ?? '',
      serviceDurationMinutes: appt.service?.durationMinutes ?? 0,
      scheduledDate: appt.scheduledDate.toISOString().split('T')[0],
      scheduledTime: appt.scheduledTime,
      endTime: appt.endTime,
      status: appt.status,
      paymentStatus: appt.payment?.status ?? undefined,
      notes: appt.notes ?? undefined,
      createdViaBot: appt.createdViaBot,
      createdAt: appt.createdAt.toISOString(),
    }));

    return paginate(mapped, total, pagination);
  }

  async findOne(companyId: string, id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { companyId, id },
      include: {
        client: true,
        collaborator: { select: { id: true, name: true, whatsappNumber: true } },
        service: true,
        payment: true,
      },
    });
    if (!appt) throw new NotFoundException('Agendamento não encontrado');
    return appt;
  }

  async confirm(companyId: string, id: string, userId: string) {
    const appt = await this.findOne(companyId, id);
    if (appt.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        `Não é possível confirmar agendamento com status ${appt.status}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_UPDATED,
      entity: 'Appointment',
      entityId: id,
      newValue: { status: AppointmentStatus.CONFIRMED },
    });

    return updated;
  }

  async start(companyId: string, id: string, userId: string) {
    const appt = await this.findOne(companyId, id);
    if (
      appt.status !== AppointmentStatus.CONFIRMED &&
      appt.status !== AppointmentStatus.SCHEDULED
    ) {
      throw new BadRequestException(`Não é possível iniciar agendamento com status ${appt.status}`);
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.IN_PROGRESS, startedAt: new Date() },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_UPDATED,
      entity: 'Appointment',
      entityId: id,
      newValue: { status: AppointmentStatus.IN_PROGRESS },
    });

    return updated;
  }

  async complete(companyId: string, id: string, userId: string) {
    const appt = await this.findOne(companyId, id);
    if (appt.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Não é possível finalizar agendamento com status ${appt.status}`,
      );
    }

    const [updated] = await Promise.all([
      this.prisma.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.COMPLETED, completedAt: new Date() },
      }),
      this.prisma.client.update({
        where: { id: appt.clientId },
        data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
      }),
    ]);

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_COMPLETED,
      entity: 'Appointment',
      entityId: id,
    });

    return updated;
  }

  async cancel(
    companyId: string,
    id: string,
    dto: CancelAppointmentDto,
    userId: string,
    byAdmin = false,
  ) {
    const appt = await this.findOne(companyId, id);
    const cancellable = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
    if (!(cancellable as string[]).includes(appt.status)) {
      throw new BadRequestException(
        `Não é possível cancelar agendamento com status ${appt.status}`,
      );
    }

    if (!byAdmin) {
      const rules = await this.prisma.businessRules.findUnique({ where: { companyId } });
      if (rules?.cancellationAllowed === false) {
        throw new BadRequestException('Cancelamento não permitido para esta empresa');
      }

      if (rules?.cancellationMinHours) {
        const dateStr = appt.scheduledDate.toISOString().split('T')[0];
        const appointmentDateTime = new Date(`${dateStr}T${appt.scheduledTime}:00`);
        const hoursUntil = differenceInHours(appointmentDateTime, new Date());
        if (hoursUntil < rules.cancellationMinHours) {
          throw new BadRequestException(
            `Cancelamento não permitido com menos de ${rules.cancellationMinHours}h de antecedência`,
          );
        }
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancelReason: dto.reason,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_CANCELLED,
      entity: 'Appointment',
      entityId: id,
      newValue: { reason: dto.reason },
    });

    const whatsappConfig = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (whatsappConfig?.isConnected) {
      const dateStr = appt.scheduledDate.toISOString().split('T')[0];
      const appointmentDetails = `*${appt.service.name}* com ${appt.collaborator.name} em ${dateStr} às ${appt.scheduledTime}`;
      const message = whatsappConfig.cancellationMessage
        ? `${whatsappConfig.cancellationMessage}\n\nAgendamento: ${appointmentDetails}`
        : `Olá, ${appt.client.name}! Seu agendamento de ${appointmentDetails} foi cancelado.${dto.reason ? `\nMotivo: ${dto.reason}` : ''}`;
      await this.notifications.enqueueWhatsapp({
        companyId,
        instanceName: whatsappConfig.instanceName,
        toNumber: appt.client.whatsappNumber,
        message,
        type: NotificationType.APPOINTMENT_CANCELLED,
        clientId: appt.clientId,
      });
    }

    return updated;
  }

  async noShow(companyId: string, id: string, userId: string) {
    const appt = await this.findOne(companyId, id);
    const cancellable = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
    if (!(cancellable as string[]).includes(appt.status)) {
      throw new BadRequestException(
        `Não é possível marcar no-show para agendamento com status ${appt.status}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW, noShowAt: new Date() },
    });

    await this.clientsService.recordAbsence(companyId, appt.clientId, id);

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_NO_SHOW,
      entity: 'Appointment',
      entityId: id,
    });

    return updated;
  }

  async delete(companyId: string, id: string, userId: string) {
    const appt = await this.findOne(companyId, id);
    const terminal: AppointmentStatus[] = [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    if (!terminal.includes(appt.status)) {
      throw new BadRequestException(
        'Só é possível excluir agendamentos cancelados, concluídos ou com falta',
      );
    }

    await this.prisma.appointment.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Appointment',
      entityId: id,
      newValue: { deleted: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAppointmentDto, userId: string) {
    const appt = await this.findOne(companyId, id);
    const editable = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
    if (!(editable as string[]).includes(appt.status)) {
      throw new BadRequestException('Não é possível editar agendamento neste status');
    }

    let endTime = appt.endTime;
    if (dto.scheduledTime) {
      const service = await this.prisma.service.findFirst({ where: { id: appt.serviceId } });
      if (service) {
        endTime = minutesToTime(timeToMinutes(dto.scheduledTime) + service.durationMinutes);
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        scheduledTime: dto.scheduledTime,
        endTime,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.APPOINTMENT_UPDATED,
      entity: 'Appointment',
      entityId: id,
      oldValue: { scheduledDate: appt.scheduledDate, scheduledTime: appt.scheduledTime },
      newValue: { scheduledDate: dto.scheduledDate, scheduledTime: dto.scheduledTime },
    });

    return updated;
  }
}
