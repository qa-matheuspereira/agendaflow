import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { CreateBusinessHourDto } from './dto/create-business-hour.dto';
import { CreateSpecialDayDto } from './dto/create-special-day.dto';
import { CreateBreakDto } from './dto/create-break.dto';

function dateRange(dateStr: string) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

@Injectable()
export class BusinessHoursService {
  private readonly logger = new Logger(BusinessHoursService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsertBusinessHour(companyId: string, dto: CreateBusinessHourDto, userId: string) {
    if (dto.isOpen !== false && dto.openTime >= dto.closeTime) {
      throw new BadRequestException('openTime deve ser anterior a closeTime');
    }

    const existing = await this.prisma.businessHour.findFirst({
      where: {
        companyId,
        dayOfWeek: dto.dayOfWeek,
        collaboratorId: dto.collaboratorId ?? null,
      },
    });

    let record;
    if (existing) {
      record = await this.prisma.businessHour.update({
        where: { id: existing.id },
        data: {
          openTime: dto.openTime,
          closeTime: dto.closeTime,
          isOpen: dto.isOpen ?? true,
          slotDurationMin: dto.slotDurationMin ?? existing.slotDurationMin,
        },
      });
    } else {
      record = await this.prisma.businessHour.create({
        data: {
          companyId,
          dayOfWeek: dto.dayOfWeek,
          openTime: dto.openTime,
          closeTime: dto.closeTime,
          isOpen: dto.isOpen ?? true,
          slotDurationMin: dto.slotDurationMin ?? 30,
          collaboratorId: dto.collaboratorId,
        },
      });
    }

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'BusinessHour',
      entityId: record.id,
      newValue: { dayOfWeek: dto.dayOfWeek, openTime: dto.openTime, closeTime: dto.closeTime },
    });

    return record;
  }

  async findBusinessHours(companyId: string, collaboratorId?: string) {
    return this.prisma.businessHour.findMany({
      where: {
        companyId,
        collaboratorId: collaboratorId !== undefined ? collaboratorId : null,
      },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async createSpecialDay(companyId: string, dto: CreateSpecialDayDto, userId: string) {
    if (!dto.isClosed && !dto.isHoliday && dto.openTime && dto.closeTime) {
      if (dto.openTime >= dto.closeTime) {
        throw new BadRequestException('openTime deve ser anterior a closeTime');
      }
    }

    const record = await this.prisma.specialDay.create({
      data: {
        companyId,
        date: new Date(dto.date),
        isHoliday: dto.isHoliday ?? false,
        isClosed: dto.isClosed ?? false,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        description: dto.description,
        collaboratorId: dto.collaboratorId,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'SpecialDay',
      entityId: record.id,
      newValue: { date: dto.date, isClosed: dto.isClosed },
    });

    return record;
  }

  async findSpecialDays(companyId: string, year: number, month?: number) {
    const start = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const end = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59);

    return this.prisma.specialDay.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  async deleteSpecialDay(companyId: string, id: string, userId: string) {
    const record = await this.prisma.specialDay.findFirst({ where: { companyId, id } });
    if (!record) throw new NotFoundException('Dia especial não encontrado');

    await this.prisma.specialDay.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'SpecialDay',
      entityId: id,
      oldValue: { date: record.date },
    });
  }

  async createBreak(companyId: string, dto: CreateBreakDto, userId: string) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime deve ser anterior a endTime');
    }

    const collaborator = await this.prisma.collaborator.findFirst({
      where: { companyId, id: dto.collaboratorId },
    });
    if (!collaborator) throw new NotFoundException('Colaborador não encontrado');

    const record = await this.prisma.break.create({
      data: {
        companyId,
        collaboratorId: dto.collaboratorId,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Break',
      entityId: record.id,
      newValue: { date: dto.date, startTime: dto.startTime, endTime: dto.endTime },
    });

    return record;
  }

  async findBreaks(companyId: string, collaboratorId?: string, date?: string) {
    return this.prisma.break.findMany({
      where: {
        companyId,
        ...(collaboratorId ? { collaboratorId } : {}),
        ...(date ? { date: dateRange(date) } : {}),
      },
      include: { collaborator: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async deleteBreak(companyId: string, id: string, userId: string) {
    const record = await this.prisma.break.findFirst({ where: { companyId, id } });
    if (!record) throw new NotFoundException('Pausa não encontrada');

    await this.prisma.break.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Break',
      entityId: id,
      oldValue: { date: record.date },
    });
  }
}
