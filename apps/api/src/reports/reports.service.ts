import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { AppointmentStatus, PaymentStatus, QueueStatus } from '@prisma/client';

function utcDateRange(dateStr: string) {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T00:00:00.000Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function utcRangeFromTo(dateFrom: string, dateTo: string) {
  const start = new Date(dateFrom + 'T00:00:00.000Z');
  const end = new Date(dateTo + 'T00:00:00.000Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKpis(companyId: string) {
    const todayStr = todayDateStr();
    const todayRange = utcDateRange(todayStr);
    const tomorrow = new Date(todayRange.lt);

    const now = new Date();
    const weekStartLocal = new Date(now);
    weekStartLocal.setDate(weekStartLocal.getDate() - weekStartLocal.getDay());
    const weekStartStr = `${weekStartLocal.getFullYear()}-${String(weekStartLocal.getMonth() + 1).padStart(2, '0')}-${String(weekStartLocal.getDate()).padStart(2, '0')}`;
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const weekStart = new Date(weekStartStr + 'T00:00:00.000Z');
    const monthStart = new Date(monthStartStr + 'T00:00:00.000Z');

    const [todayTotal, todayCompleted, todayCancelled, todayNoShow, weekTotal, monthTotal, paidResult] =
      await Promise.all([
        this.prisma.appointment.count({ where: { companyId, scheduledDate: todayRange } }),
        this.prisma.appointment.count({ where: { companyId, scheduledDate: todayRange, status: AppointmentStatus.COMPLETED } }),
        this.prisma.appointment.count({ where: { companyId, scheduledDate: todayRange, status: AppointmentStatus.CANCELLED } }),
        this.prisma.appointment.count({ where: { companyId, scheduledDate: todayRange, status: AppointmentStatus.NO_SHOW } }),
        this.prisma.appointment.count({ where: { companyId, scheduledDate: { gte: weekStart, lt: tomorrow } } }),
        this.prisma.appointment.count({ where: { companyId, scheduledDate: { gte: monthStart, lt: tomorrow } } }),
        this.prisma.payment.aggregate({
          where: { companyId, status: PaymentStatus.PAID, paidAt: { gte: monthStart, lt: tomorrow } },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

    const cancellationRate = todayTotal > 0 ? todayCancelled / todayTotal : 0;
    const noShowRate = todayTotal > 0 ? todayNoShow / todayTotal : 0;
    const revenue = paidResult._sum.amount?.toNumber() ?? 0;
    const paidCount = paidResult._count.id ?? 0;
    const averageTicket = paidCount > 0 ? revenue / paidCount : 0;

    return {
      todayTotal,
      todayCompleted,
      todayCancelled,
      todayNoShow,
      weekTotal,
      monthTotal,
      cancellationRate,
      noShowRate,
      averageTicket,
    };
  }

  async getKpis(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const baseWhere = {
      companyId,
      scheduledDate: { gte: start, lt: end },
      ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {}),
      ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
    };

    const [
      total,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
      inProgress,
      revenueResult,
      newClients,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: baseWhere }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.SCHEDULED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.CONFIRMED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.COMPLETED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.CANCELLED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.NO_SHOW } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.IN_PROGRESS } }),
      this.prisma.payment.aggregate({
        where: { companyId, status: PaymentStatus.PAID, paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      this.prisma.client.count({
        where: { companyId, createdAt: { gte: start, lt: end } },
      }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
    const revenue = revenueResult._sum.amount?.toNumber() ?? 0;

    const diffDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      period: { from: filter.dateFrom, to: filter.dateTo },
      appointments: { total, scheduled, confirmed, completed, cancelled, noShow, inProgress },
      rates: { completionRate, noShowRate },
      revenue: { total: revenue, currency: 'BRL' },
      clients: { new: newClients },
      avgPerDay: Math.round(total / diffDays),
    };
  }

  async getAppointmentsByService(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const grouped = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where: {
        companyId,
        scheduledDate: { gte: start, lt: end },
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {}),
      },
      _count: { id: true },
    });

    const serviceIds = grouped.map((g) => g.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });

    const serviceMap = new Map(services.map((s) => [s.id, s.name]));

    return grouped
      .map((g) => ({
        serviceId: g.serviceId,
        serviceName: serviceMap.get(g.serviceId) ?? 'Desconhecido',
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getAppointmentsByCollaborator(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const grouped = await this.prisma.appointment.groupBy({
      by: ['collaboratorId', 'status'],
      where: {
        companyId,
        scheduledDate: { gte: start, lt: end },
        ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
      },
      _count: { id: true },
    });

    const collaboratorIds = [...new Set(grouped.map((g) => g.collaboratorId))];
    const collaborators = await this.prisma.collaborator.findMany({
      where: { id: { in: collaboratorIds } },
      select: { id: true, name: true },
    });

    const collabMap = new Map(collaborators.map((c) => [c.id, c.name]));

    const result: Record<
      string,
      { collaboratorId: string; collaboratorName: string; total: number; byStatus: Record<string, number> }
    > = {};

    for (const row of grouped) {
      if (!result[row.collaboratorId]) {
        result[row.collaboratorId] = {
          collaboratorId: row.collaboratorId,
          collaboratorName: collabMap.get(row.collaboratorId) ?? 'Desconhecido',
          total: 0,
          byStatus: {},
        };
      }
      result[row.collaboratorId].total += row._count.id;
      result[row.collaboratorId].byStatus[row.status] = row._count.id;
    }

    return Object.values(result).sort((a, b) => b.total - a.total);
  }

  async getQueueStats(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const [total, done, left] = await Promise.all([
      this.prisma.queueEntry.count({ where: { companyId, joinedAt: { gte: start, lt: end } } }),
      this.prisma.queueEntry.count({ where: { companyId, status: QueueStatus.DONE, joinedAt: { gte: start, lt: end } } }),
      this.prisma.queueEntry.count({ where: { companyId, status: QueueStatus.LEFT, joinedAt: { gte: start, lt: end } } }),
    ]);

    const abandonRate = total > 0 ? Math.round((left / total) * 100) : 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, left, abandonRate, completionRate };
  }
}
