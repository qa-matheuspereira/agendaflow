import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditAction } from '@agendaflow/shared';
import { AuditFilterDto } from './dto/audit-filter.dto';
import { paginate } from '@/core/dto/pagination.dto';

interface AuditParams {
  companyId: string;
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          oldValue: params.oldValue ? (params.oldValue as object) : undefined,
          newValue: params.newValue ? (params.newValue as object) : undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      // Nunca deixar falha de auditoria derrubar a operação principal
      this.logger.error('Falha ao registrar audit log:', err);
    }
  }

  async findAll(companyId: string, filter: AuditFilterDto) {
    const where = {
      companyId,
      ...(filter.entity ? { entity: filter.entity } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
      ...((filter.dateFrom || filter.dateTo)
        ? {
            createdAt: {
              ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
              ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.skip,
        take: filter.limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          oldValue: true,
          newValue: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, filter);
  }

  async findByEntity(companyId: string, entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { companyId, entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
