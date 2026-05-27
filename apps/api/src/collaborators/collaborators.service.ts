import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { PaginationDto, paginate } from '@/core/dto/pagination.dto';

@Injectable()
export class CollaboratorsService {
  private readonly logger = new Logger(CollaboratorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, dto: CreateCollaboratorDto, userId: string) {
    const exists = await this.prisma.collaborator.findUnique({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber: dto.whatsappNumber } },
    });
    if (exists) {
      throw new ConflictException(`Número ${dto.whatsappNumber} já cadastrado nesta empresa`);
    }

    if (dto.serviceIds?.length) {
      const servicesCount = await this.prisma.service.count({
        where: { companyId, id: { in: dto.serviceIds }, isActive: true },
      });
      if (servicesCount !== dto.serviceIds.length) {
        throw new BadRequestException('Um ou mais serviços não encontrados ou inativos');
      }
    }

    const collaborator = await this.prisma.collaborator.create({
      data: {
        companyId,
        name: dto.name,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        bio: dto.bio,
        canViewSchedule: dto.canViewSchedule ?? true,
        canCreateSchedule: dto.canCreateSchedule ?? true,
        canEditSchedule: dto.canEditSchedule ?? true,
        canDeleteSchedule: dto.canDeleteSchedule ?? false,
        canCreateBreak: dto.canCreateBreak ?? true,
        canCallNextQueue: dto.canCallNextQueue ?? true,
        canFinishService: dto.canFinishService ?? true,
        hideFromBot: dto.hideFromBot ?? false,
        services: dto.serviceIds?.length
          ? { create: dto.serviceIds.map((sid) => ({ serviceId: sid })) }
          : undefined,
      },
      include: { services: { include: { service: true } } },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.USER_CREATED,
      entity: 'Collaborator',
      entityId: collaborator.id,
      newValue: { name: collaborator.name, whatsappNumber: collaborator.whatsappNumber },
    });

    return collaborator;
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: { search?: string; isActive?: boolean },
  ) {
    const where = {
      companyId,
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
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
      this.prisma.collaborator.findMany({
        where,
        include: {
          services: { include: { service: { select: { id: true, name: true } } } },
          _count: { select: { appointments: true } },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.collaborator.count({ where }),
    ]);
    const mapped = data.map((c) => ({ ...c, services: c.services.map((cs) => cs.service) }));
    return paginate(mapped, total, pagination);
  }

  async findOne(companyId: string, id: string) {
    const collaborator = await this.prisma.collaborator.findFirst({
      where: { companyId, id },
      include: {
        services: { include: { service: true } },
        businessHours: true,
        _count: { select: { appointments: true } },
      },
    });
    if (!collaborator) throw new NotFoundException('Colaborador não encontrado');
    return { ...collaborator, services: collaborator.services.map((cs) => cs.service) };
  }

  async findByWhatsapp(companyId: string, whatsappNumber: string) {
    return this.prisma.collaborator.findFirst({
      where: { companyId, whatsappNumber, isActive: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateCollaboratorDto, userId: string) {
    const collaborator = await this.findOne(companyId, id);

    if (dto.whatsappNumber && dto.whatsappNumber !== collaborator.whatsappNumber) {
      const exists = await this.prisma.collaborator.findUnique({
        where: { companyId_whatsappNumber: { companyId, whatsappNumber: dto.whatsappNumber } },
      });
      if (exists) throw new ConflictException('Número WhatsApp já em uso por outro colaborador');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.serviceIds !== undefined) {
        await tx.collaboratorService.deleteMany({ where: { collaboratorId: id } });
        if (dto.serviceIds.length > 0) {
          await tx.collaboratorService.createMany({
            data: dto.serviceIds.map((sid) => ({ collaboratorId: id, serviceId: sid })),
          });
        }
      }
      return tx.collaborator.update({
        where: { id },
        data: {
          name: dto.name,
          whatsappNumber: dto.whatsappNumber,
          whatsappLid: dto.whatsappLid,
          email: dto.email,
          bio: dto.bio,
          canViewSchedule: dto.canViewSchedule,
          canCreateSchedule: dto.canCreateSchedule,
          canEditSchedule: dto.canEditSchedule,
          canDeleteSchedule: dto.canDeleteSchedule,
          canCreateBreak: dto.canCreateBreak,
          canCallNextQueue: dto.canCallNextQueue,
          canFinishService: dto.canFinishService,
          hideFromBot: dto.hideFromBot,
        },
        include: { services: { include: { service: true } } },
      });
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Collaborator',
      entityId: id,
      oldValue: { name: collaborator.name },
      newValue: { name: updated.name },
    });

    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    const updated = await this.prisma.collaborator.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      companyId, userId, action: AuditAction.SETTINGS_UPDATED,
      entity: 'Collaborator', entityId: id,
      newValue: { isActive: false },
    });
    return updated;
  }

  async activate(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    const updated = await this.prisma.collaborator.update({ where: { id }, data: { isActive: true } });
    await this.audit.log({
      companyId, userId, action: AuditAction.SETTINGS_UPDATED,
      entity: 'Collaborator', entityId: id,
      newValue: { isActive: true },
    });
    return updated;
  }
}
