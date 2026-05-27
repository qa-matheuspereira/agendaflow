import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PaginationDto, paginate } from '@/core/dto/pagination.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  async createCategory(companyId: string, dto: CreateCategoryDto, userId: string) {
    return this.prisma.serviceCategory.create({
      data: { companyId, name: dto.name, color: dto.color, icon: dto.icon, order: dto.order ?? 0 },
    });
  }

  async findAllCategories(companyId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { companyId },
      include: { _count: { select: { services: true } } },
      orderBy: { order: 'asc' },
    });
  }

  async deleteCategory(companyId: string, id: string) {
    const cat = await this.prisma.serviceCategory.findFirst({ where: { companyId, id } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    const hasServices = await this.prisma.service.count({ where: { companyId, categoryId: id } });
    if (hasServices > 0) throw new ConflictException('Categoria possui serviços vinculados. Mova-os antes de excluir.');
    return this.prisma.serviceCategory.delete({ where: { id } });
  }

  // ─── Services ───────────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateServiceDto, userId: string) {
    if (dto.categoryId) {
      const cat = await this.prisma.serviceCategory.findFirst({ where: { companyId, id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Categoria não encontrada');
    }

    const service = await this.prisma.service.create({
      data: {
        companyId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        breakAfterMinutes: dto.breakAfterMinutes ?? 0,
        price: dto.price,
        requiresDocument: dto.requiresDocument ?? false,
        documentInstruction: dto.documentInstruction,
        requiresAdvancePayment: dto.requiresAdvancePayment ?? false,
        advancePaymentType: dto.advancePaymentType,
        advancePaymentValue: dto.advancePaymentValue ?? null,
        maxDailyAppointments: dto.maxDailyAppointments,
        order: dto.order ?? 0,
        schedulingMode: dto.schedulingMode ?? 'SCHEDULE',
        autoDistribute: dto.autoDistribute ?? false,
        isActive: true,
      },
      include: { category: true },
    });

    await this.audit.log({
      companyId, userId, action: AuditAction.SETTINGS_UPDATED,
      entity: 'Service', entityId: service.id,
      newValue: { name: service.name, price: service.price.toString() },
    });

    return service;
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    filters?: { onlyActive?: boolean; search?: string },
  ) {
    const where = {
      companyId,
      ...(filters?.onlyActive ? { isActive: true } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { description: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          category: true,
          collaborators: { include: { collaborator: { select: { id: true, name: true } } } },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  async findOne(companyId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { companyId, id },
      include: {
        category: true,
        collaborators: { include: { collaborator: { select: { id: true, name: true, isActive: true } } } },
      },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');
    return service;
  }

  async findByIdOrThrow(companyId: string, id: string) {
    return this.findOne(companyId, id);
  }

  async update(companyId: string, id: string, dto: UpdateServiceDto, userId: string) {
    await this.findOne(companyId, id);
    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        breakAfterMinutes: dto.breakAfterMinutes,
        price: dto.price,
        requiresDocument: dto.requiresDocument,
        documentInstruction: dto.documentInstruction,
        requiresAdvancePayment: dto.requiresAdvancePayment,
        advancePaymentType: dto.advancePaymentType,
        advancePaymentValue: dto.advancePaymentValue,
        maxDailyAppointments: dto.maxDailyAppointments,
        order: dto.order,
        schedulingMode: dto.schedulingMode,
        autoDistribute: dto.autoDistribute,
      },
      include: { category: true },
    });
    await this.audit.log({
      companyId, userId, action: AuditAction.SETTINGS_UPDATED,
      entity: 'Service', entityId: id,
      newValue: { name: updated.name },
    });
    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }

  async activate(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    const updated = await this.prisma.service.update({ where: { id }, data: { isActive: true } });
    await this.audit.log({
      companyId, userId, action: AuditAction.SETTINGS_UPDATED,
      entity: 'Service', entityId: id,
      newValue: { isActive: true },
    });
    return updated;
  }
}
