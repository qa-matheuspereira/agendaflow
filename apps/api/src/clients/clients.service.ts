import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { BlockClientDto } from './dto/block-client.dto';
import { PaginationDto, paginate } from '@/core/dto/pagination.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, dto: CreateClientDto, userId?: string) {
    const exists = await this.prisma.client.findUnique({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: dto.whatsappNumber } },
    });
    if (exists) throw new ConflictException('Cliente já cadastrado com este número WhatsApp');

    const client = await this.prisma.client.create({
      data: {
        companyId,
        name: dto.name,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        birthdate: dto.birthdate ? new Date(dto.birthdate) : undefined,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.CLIENT_CREATED,
      entity: 'Client',
      entityId: client.id,
      newValue: { name: client.name, whatsappNumber: client.whatsappNumber },
    });

    return client;
  }

  async findOrCreate(companyId: string, whatsappNumber: string, name: string) {
    const existing = await this.prisma.client.findUnique({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber } },
    });
    if (existing) return existing;

    return this.create(companyId, { name, whatsappNumber });
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: { search?: string; isBlocked?: boolean },
  ) {
    const where = {
      companyId,
      ...(filters?.isBlocked !== undefined ? { isBlocked: filters.isBlocked } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { whatsappNumber: { contains: filters.search } },
              { email: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: {
          clientPlan: true,
          _count: { select: { appointments: true, absences: true } },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(data, total, pagination);
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { companyId, id },
      include: {
        clientPlan: true,
        absences: { orderBy: { occurredAt: 'desc' }, take: 10 },
        appointments: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
          include: { service: { select: { name: true } }, collaborator: { select: { name: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  async findByWhatsapp(companyId: string, whatsappNumber: string) {
    return this.prisma.client.findUnique({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber } },
    });
  }

  async update(companyId: string, id: string, dto: UpdateClientDto, userId: string) {
    const client = await this.findOne(companyId, id);

    if (dto.whatsappNumber && dto.whatsappNumber !== client.whatsappNumber) {
      const exists = await this.prisma.client.findUnique({
        where: { companyId_whatsappNumber: { companyId, whatsappNumber: dto.whatsappNumber } },
      });
      if (exists) throw new ConflictException('Número WhatsApp já em uso por outro cliente');
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        birthdate: dto.birthdate ? new Date(dto.birthdate) : undefined,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Client',
      entityId: id,
      oldValue: { name: client.name },
      newValue: { name: updated.name },
    });

    return updated;
  }

  async block(companyId: string, id: string, dto: BlockClientDto, userId: string) {
    const client = await this.findOne(companyId, id);
    if (client.isBlocked) throw new BadRequestException('Cliente já está bloqueado');

    const updated = await this.prisma.client.update({
      where: { id },
      data: { isBlocked: true, blockedReason: dto.reason, blockedAt: new Date() },
    });

    await this.audit.log({
      companyId, userId, action: AuditAction.CLIENT_BLOCKED,
      entity: 'Client', entityId: id,
      newValue: { reason: dto.reason },
    });

    return updated;
  }

  async unblock(companyId: string, id: string, userId: string) {
    const client = await this.findOne(companyId, id);
    if (!client.isBlocked) throw new BadRequestException('Cliente não está bloqueado');

    const updated = await this.prisma.client.update({
      where: { id },
      data: { isBlocked: false, blockedReason: null, blockedAt: null, absenceCount: 0 },
    });

    await this.audit.log({
      companyId, userId, action: AuditAction.CLIENT_UNBLOCKED,
      entity: 'Client', entityId: id,
    });

    return updated;
  }

  async delete(companyId: string, id: string, userId: string) {
    const client = await this.prisma.client.findFirst({ where: { companyId, id } });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const activeAppt = await this.prisma.appointment.findFirst({
      where: {
        companyId,
        clientId: id,
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });
    if (activeAppt) throw new BadRequestException('Não é possível excluir cliente com agendamentos ativos ou futuros');

    await this.prisma.$transaction([
      this.prisma.queueEntry.deleteMany({ where: { clientId: id } }),
      this.prisma.appointment.deleteMany({ where: { clientId: id } }),
      this.prisma.client.delete({ where: { id } }),
    ]);

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Client',
      entityId: id,
      newValue: { deleted: true, name: client.name },
    });
  }

  async recordAbsence(companyId: string, clientId: string, appointmentId?: string) {
    const client = await this.prisma.client.findFirst({ where: { companyId, id: clientId } });
    if (!client) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.clientAbsence.create({
        data: { clientId, companyId, appointmentId },
      });
      await tx.client.update({
        where: { id: clientId },
        data: { absenceCount: { increment: 1 }, trustScore: { decrement: 10 } },
      });
    });

    // Verifica bloqueio automático
    await this.checkAutoBlock(companyId, clientId);
  }

  private async checkAutoBlock(companyId: string, clientId: string) {
    const rules = await this.prisma.businessRules.findUnique({ where: { companyId } });
    if (!rules?.autoBlockEnabled) return;

    const since = new Date();
    since.setDate(since.getDate() - rules.autoBlockWindowDays);

    const absences = await this.prisma.clientAbsence.count({
      where: { companyId, clientId, occurredAt: { gte: since } },
    });

    if (absences >= rules.autoBlockAfterAbsences) {
      const client = await this.prisma.client.findFirst({ where: { companyId, id: clientId } });
      if (client && !client.isBlocked) {
        await this.prisma.client.update({
          where: { id: clientId },
          data: {
            isBlocked: true,
            blockedReason: `AUTO: ${absences} faltas em ${rules.autoBlockWindowDays} dias`,
            blockedAt: new Date(),
          },
        });
        await this.audit.log({
          companyId,
          action: AuditAction.CLIENT_AUTO_BLOCKED,
          entity: 'Client',
          entityId: clientId,
          newValue: { absences, windowDays: rules.autoBlockWindowDays },
        });
        this.logger.log(`Cliente ${clientId} bloqueado automaticamente por ${absences} faltas`);
      }
    }
  }
}
