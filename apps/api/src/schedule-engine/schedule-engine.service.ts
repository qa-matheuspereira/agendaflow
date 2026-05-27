import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { RedisService } from '@/core/redis/redis.service';
import { GetSlotsDto } from './dto/get-slots.dto';
import { AppointmentStatus, DayOfWeek } from '@agendaflow/shared';

export interface TimeSlot {
  time: string;
  available: boolean;
}

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

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
export class ScheduleEngineService {
  private readonly logger = new Logger(ScheduleEngineService.name);
  private readonly LOCK_TTL_MS = 10_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAvailableSlots(companyId: string, dto: GetSlotsDto): Promise<TimeSlot[]> {
    const dateStr = dto.date;
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = JS_DAY_TO_ENUM[localDate.getDay()];

    const service = await this.prisma.service.findFirst({
      where: { companyId, id: dto.serviceId, isActive: true },
    });
    if (!service) throw new BadRequestException('Serviço não encontrado ou inativo');

    const totalServiceTime = service.durationMinutes + service.breakAfterMinutes;

    const specialDay = await this.prisma.specialDay.findFirst({
      where: { companyId, date: dateRange(dateStr) },
    });

    if (specialDay?.isClosed || specialDay?.isHoliday) return [];

    const collaboratorIds: string[] = [];
    if (dto.collaboratorId) {
      const collab = await this.prisma.collaborator.findFirst({
        where: {
          companyId,
          id: dto.collaboratorId,
          isActive: true,
          services: { some: { serviceId: dto.serviceId } },
        },
      });
      if (!collab) throw new BadRequestException('Colaborador não encontrado, inativo ou não realiza este serviço');
      collaboratorIds.push(dto.collaboratorId);
    } else {
      const collabs = await this.prisma.collaborator.findMany({
        where: {
          companyId,
          isActive: true,
          services: { some: { serviceId: dto.serviceId } },
        },
        select: { id: true },
      });
      collaboratorIds.push(...collabs.map((c) => c.id));

      // If no collaborators linked to this service, fall back to all active company collaborators
      if (collaboratorIds.length === 0) {
        const allCollabs = await this.prisma.collaborator.findMany({
          where: { companyId, isActive: true },
          select: { id: true },
        });
        collaboratorIds.push(...allCollabs.map((c) => c.id));
        this.logger.warn(`No collaborators linked to service ${dto.serviceId} — falling back to all ${allCollabs.length} active collaborators`);
      }
    }

    if (collaboratorIds.length === 0) return [];

    let openTime: string | undefined;
    let closeTime: string | undefined;
    let slotDurationMin = 30;

    if (dto.collaboratorId) {
      const collabHour = await this.prisma.businessHour.findFirst({
        where: { companyId, collaboratorId: dto.collaboratorId, dayOfWeek, isOpen: true },
      });
      const companyHour = await this.prisma.businessHour.findFirst({
        where: { companyId, collaboratorId: null, dayOfWeek, isOpen: true },
      });
      const bh = collabHour ?? companyHour;
      if (!bh) return [];
      openTime = specialDay?.openTime ?? bh.openTime;
      closeTime = specialDay?.closeTime ?? bh.closeTime;
      slotDurationMin = bh.slotDurationMin;
    } else {
      // Try company-level hours first; fall back to any collaborator's hours if not configured at company level
      let bh = await this.prisma.businessHour.findFirst({
        where: { companyId, collaboratorId: null, dayOfWeek, isOpen: true },
      });
      if (!bh && collaboratorIds.length > 0) {
        bh = await this.prisma.businessHour.findFirst({
          where: { companyId, collaboratorId: { in: collaboratorIds }, dayOfWeek, isOpen: true },
        });
      }
      if (!bh) return [];
      openTime = specialDay?.openTime ?? bh.openTime;
      closeTime = specialDay?.closeTime ?? bh.closeTime;
      slotDurationMin = bh.slotDurationMin;
    }

    if (!openTime || !closeTime) return [];

    const open = timeToMinutes(openTime);
    const close = timeToMinutes(closeTime);

    // For today: only offer slots that start at least 1 minute from now
    const now = new Date();
    const isToday =
      localDate.getFullYear() === now.getFullYear() &&
      localDate.getMonth() === now.getMonth() &&
      localDate.getDate() === now.getDate();
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() + 1 : 0;

    const candidateSlots: string[] = [];
    for (let t = open; t + totalServiceTime <= close; t += slotDurationMin) {
      if (t >= nowMinutes) candidateSlots.push(minutesToTime(t));
    }

    if (candidateSlots.length === 0) return [];

    const availableSet = new Set<string>();
    for (const collabId of collaboratorIds) {
      const free = await this.checkCollaboratorSlots(
        companyId,
        collabId,
        dateStr,
        candidateSlots,
        totalServiceTime,
      );
      free.forEach((s) => availableSet.add(s));
    }

    return candidateSlots.map((slot) => ({
      time: slot,
      available: availableSet.has(slot),
    }));
  }

  private async checkCollaboratorSlots(
    companyId: string,
    collaboratorId: string,
    dateStr: string,
    slots: string[],
    totalServiceTime: number,
  ): Promise<string[]> {
    const [breaks, appointments] = await Promise.all([
      this.prisma.break.findMany({
        where: { companyId, collaboratorId, date: dateRange(dateStr) },
      }),
      this.prisma.appointment.findMany({
        where: {
          companyId,
          collaboratorId,
          scheduledDate: dateRange(dateStr),
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
            ],
          },
        },
        include: { service: { select: { durationMinutes: true, breakAfterMinutes: true } } },
      }),
    ]);

    const available: string[] = [];

    for (const slot of slots) {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + totalServiceTime;
      let blocked = false;

      for (const brk of breaks) {
        const breakStart = timeToMinutes(brk.startTime);
        const breakEnd = timeToMinutes(brk.endTime);
        if (slotStart < breakEnd && slotEnd > breakStart) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        for (const appt of appointments) {
          const apptStart = timeToMinutes(appt.scheduledTime);
          const apptDuration = appt.service.durationMinutes + appt.service.breakAfterMinutes;
          const apptEnd = apptStart + apptDuration;
          if (slotStart < apptEnd && slotEnd > apptStart) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) available.push(slot);
    }

    return available;
  }

  async getAvailableDatesInMonth(
    companyId: string,
    serviceId: string,
    collaboratorId: string | undefined,
    year: number,
    month: number, // 1-based
  ): Promise<string[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = firstDay < today ? today : firstDay;

    const availableDates: string[] = [];

    for (let d = new Date(startDate); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      try {
        const slots = await this.getAvailableSlots(companyId, {
          date: dateStr,
          serviceId,
          collaboratorId,
        } as Parameters<ScheduleEngineService['getAvailableSlots']>[1]);

        if (slots.some((s) => s.available)) {
          availableDates.push(dateStr);
        }
      } catch {
        // service/collaborator invalid — skip
      }
    }

    return availableDates;
  }

  async getAvailableDatesInRange(
    companyId: string,
    serviceId: string,
    collaboratorId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<string[]> {
    const availableDates: string[] = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      try {
        const slots = await this.getAvailableSlots(companyId, {
          date: dateStr,
          serviceId,
          collaboratorId,
        } as Parameters<ScheduleEngineService['getAvailableSlots']>[1]);

        if (slots.some((s) => s.available)) {
          availableDates.push(dateStr);
        }
      } catch {
        // skip invalid
      }
    }

    return availableDates;
  }

  async acquireBookingLock(
    companyId: string,
    collaboratorId: string,
    date: string,
    time: string,
  ): Promise<string | null> {
    const key = `slot:${companyId}:${collaboratorId}:${date}:${time}`;
    const acquired = await this.redis.acquireLock(key, this.LOCK_TTL_MS);
    return acquired ? key : null;
  }

  async releaseBookingLock(lockKey: string): Promise<void> {
    await this.redis.releaseLock(lockKey);
  }

  async validateSlot(
    companyId: string,
    collaboratorId: string,
    serviceId: string,
    date: string,
    time: string,
  ): Promise<void> {
    const slots = await this.getAvailableSlots(companyId, { date, serviceId, collaboratorId });
    const slot = slots.find((s) => s.time === time);
    if (!slot?.available) {
      throw new BadRequestException(`Horário ${time} não está disponível para ${date}`);
    }
  }
}
