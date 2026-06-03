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
      todayTotal, todayCompleted, todayCancelled, todayNoShow,
      weekTotal, monthTotal, cancellationRate, noShowRate, averageTicket,
    };
  }

  // Returns flat shape matching frontend expectations
  async getKpis(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const baseWhere = {
      companyId,
      scheduledDate: { gte: start, lt: end },
      ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {}),
      ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
    };

    const [total, completed, cancelled, noShow, revenueResult, newClients] = await Promise.all([
      this.prisma.appointment.count({ where: baseWhere }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.COMPLETED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.CANCELLED } }),
      this.prisma.appointment.count({ where: { ...baseWhere, status: AppointmentStatus.NO_SHOW } }),
      this.prisma.payment.aggregate({
        where: { companyId, status: PaymentStatus.PAID, paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      this.prisma.client.count({ where: { companyId, createdAt: { gte: start, lt: end } } }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
    const totalRevenue = revenueResult._sum.amount?.toNumber() ?? 0;
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      totalAppointments: total,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      completionRate,
      noShowRate,
      totalRevenue,
      newClients,
      avgPerDay: Math.round(total / diffDays),
    };
  }

  async getAppointmentsByService(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const baseWhere = {
      companyId,
      scheduledDate: { gte: start, lt: end },
      ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {}),
    };

    // Group by serviceId + status to get per-status counts
    const grouped = await this.prisma.appointment.groupBy({
      by: ['serviceId', 'status'],
      where: baseWhere,
      _count: { id: true },
    });

    const serviceIds = [...new Set(grouped.map((g) => g.serviceId))];
    const [services, revenueRows] = await Promise.all([
      this.prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }),
      this.prisma.payment.groupBy({
        by: ['appointmentId'],
        where: {
          companyId,
          status: PaymentStatus.PAID,
          paidAt: { gte: start, lt: end },
          appointment: { serviceId: { in: serviceIds } },
        },
        _sum: { amount: true },
      }),
    ]);

    // Revenue needs appointment → serviceId join: fetch separately
    const paidAppts = await this.prisma.appointment.findMany({
      where: { companyId, scheduledDate: { gte: start, lt: end }, payment: { status: PaymentStatus.PAID } },
      select: { serviceId: true, payment: { select: { amount: true } } },
    });

    const revenueByService = new Map<string, number>();
    for (const a of paidAppts) {
      const prev = revenueByService.get(a.serviceId) ?? 0;
      revenueByService.set(a.serviceId, prev + (a.payment?.amount?.toNumber() ?? 0));
    }

    const serviceMap = new Map(services.map((s) => [s.id, s.name]));
    const result = new Map<string, { serviceId: string; serviceName: string; total: number; completed: number; cancelled: number; revenue: number }>();

    for (const row of grouped) {
      if (!result.has(row.serviceId)) {
        result.set(row.serviceId, {
          serviceId: row.serviceId,
          serviceName: serviceMap.get(row.serviceId) ?? 'Desconhecido',
          total: 0, completed: 0, cancelled: 0,
          revenue: revenueByService.get(row.serviceId) ?? 0,
        });
      }
      const entry = result.get(row.serviceId)!;
      entry.total += row._count.id;
      if (row.status === AppointmentStatus.COMPLETED) entry.completed += row._count.id;
      if (row.status === AppointmentStatus.CANCELLED) entry.cancelled += row._count.id;
    }

    return [...result.values()].sort((a, b) => b.total - a.total);
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

    // Revenue per collaborator
    const paidAppts = await this.prisma.appointment.findMany({
      where: { companyId, scheduledDate: { gte: start, lt: end }, payment: { status: PaymentStatus.PAID } },
      select: { collaboratorId: true, payment: { select: { amount: true } } },
    });
    const revenueByCollab = new Map<string, number>();
    for (const a of paidAppts) {
      const prev = revenueByCollab.get(a.collaboratorId) ?? 0;
      revenueByCollab.set(a.collaboratorId, prev + (a.payment?.amount?.toNumber() ?? 0));
    }

    const collabMap = new Map(collaborators.map((c) => [c.id, c.name]));
    const result = new Map<string, { collaboratorId: string; collaboratorName: string; total: number; completed: number; cancelled: number; noShow: number; revenue: number }>();

    for (const row of grouped) {
      if (!result.has(row.collaboratorId)) {
        result.set(row.collaboratorId, {
          collaboratorId: row.collaboratorId,
          collaboratorName: collabMap.get(row.collaboratorId) ?? 'Desconhecido',
          total: 0, completed: 0, cancelled: 0, noShow: 0,
          revenue: revenueByCollab.get(row.collaboratorId) ?? 0,
        });
      }
      const entry = result.get(row.collaboratorId)!;
      entry.total += row._count.id;
      if (row.status === AppointmentStatus.COMPLETED) entry.completed += row._count.id;
      if (row.status === AppointmentStatus.CANCELLED) entry.cancelled += row._count.id;
      if (row.status === AppointmentStatus.NO_SHOW) entry.noShow += row._count.id;
    }

    return [...result.values()].sort((a, b) => b.total - a.total);
  }

  async getQueueStats(companyId: string, filter: ReportFilterDto) {
    const { gte: start, lt: end } = utcRangeFromTo(filter.dateFrom, filter.dateTo);

    const [totalJoined, totalCompleted, totalLeft] = await Promise.all([
      this.prisma.queueEntry.count({ where: { companyId, joinedAt: { gte: start, lt: end } } }),
      this.prisma.queueEntry.count({ where: { companyId, status: QueueStatus.DONE, joinedAt: { gte: start, lt: end } } }),
      this.prisma.queueEntry.count({ where: { companyId, status: QueueStatus.LEFT, joinedAt: { gte: start, lt: end } } }),
    ]);

    return {
      totalJoined,
      totalCompleted,
      totalLeft,
      averageWaitMinutes: 0,
      averageServiceMinutes: 0,
    };
  }
}
