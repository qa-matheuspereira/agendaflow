import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/core/database/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '@agendaflow/shared';
import { AppointmentStatus } from '@prisma/client';

interface ReminderRule {
  minutesBefore: number;
  message?: string;
}

import { toDate, formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

function utcDateRange(dateStr: string) {
  // dateStr is 'YYYY-MM-DD'
  const start = toDate(dateStr + 'T00:00:00.000', { timeZone: TIMEZONE });
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

function localDateStr(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');
}

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Runs every 5 minutes
  @Cron('*/5 * * * *')
  async sendReminders(): Promise<void> {
    this.logger.debug('Checking reminders');
    try {
      await this.processReminders();
    } catch (err) {
      this.logger.error('Erro ao processar lembretes', err);
    }
  }

  @Cron('*/5 * * * *')
  async sendDailyReminders(): Promise<void> {
    try {
      await this.processDailyReminders();
    } catch (err) {
      this.logger.error('Erro ao processar lembretes diários', err);
    }
  }

  @Cron('*/5 * * * *')
  async autoConfirmAppointments(): Promise<void> {
    try {
      await this.processAutoConfirm();
    } catch (err) {
      this.logger.error('Erro ao processar auto-confirmações', err);
    }
  }

  private async processDailyReminders(): Promise<void> {
    const configs = await this.prisma.whatsappConfig.findMany({
      where: { isConnected: true, dailyReminderEnabled: true },
      select: { companyId: true, instanceName: true, dailyReminderTime: true, reminderMessage: true },
    });

    const now = new Date();
    const todayStr = localDateStr(now);
    const localNow = toDate(now, { timeZone: TIMEZONE });

    // Sentinel value used in sentReminderMinutes to track daily reminder sent for today
    const DAILY_SENTINEL = 1441;

    for (const config of configs) {
      const reminderTime = config.dailyReminderTime ?? '07:00';
      // Check if we're within the 5-minute window of the configured time
      const [rH, rM] = reminderTime.split(':').map(Number);
      const reminderMinutes = rH * 60 + rM;
      const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes();
      if (nowMinutes < reminderMinutes || nowMinutes >= reminderMinutes + 5) continue;

      // Get all today's SCHEDULED/CONFIRMED appointments that haven't received the daily reminder
      const appointments = await this.prisma.appointment.findMany({
        where: {
          companyId: config.companyId,
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          scheduledDate: utcDateRange(todayStr),
          NOT: { sentReminderMinutes: { has: DAILY_SENTINEL } },
        },
        select: {
          id: true,
          clientId: true,
          scheduledTime: true,
          client: { select: { whatsappNumber: true, name: true } },
          service: { select: { name: true } },
          collaborator: { select: { name: true } },
        },
      });

      for (const appt of appointments) {
        const dateFormatted = appt.scheduledDate.toISOString().split('T')[0].split('-').reverse().join('/');
        const message =
          config.reminderMessage?.replace(/{\s*nome\s*}/gi, appt.client.name)
            .replace(/{\s*servico\s*}/gi, appt.service.name)
            .replace(/{\s*horario\s*}/gi, appt.scheduledTime)
            .replace(/{\s*profissional\s*}/gi, appt.collaborator.name)
            .replace(/{\s*data\s*}/gi, dateFormatted) ??
          `Olá, ${appt.client.name}! Lembrando que você tem *${appt.service.name}* com ${appt.collaborator.name} hoje às ${appt.scheduledTime}. Até logo!`;

        await this.notifications.enqueueWhatsapp({
          companyId: config.companyId,
          instanceName: config.instanceName,
          toNumber: appt.client.whatsappNumber,
          message,
          type: NotificationType.APPOINTMENT_REMINDER,
          clientId: appt.clientId,
        });

        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: { sentReminderMinutes: { push: DAILY_SENTINEL } },
        });

        this.logger.log(`Lembrete diário enviado para agendamento ${appt.id}`);
      }
    }
  }

  private async processAutoConfirm(): Promise<void> {
    const configs = await this.prisma.whatsappConfig.findMany({
      where: { autoConfirmEnabled: true },
      select: { companyId: true, autoConfirmHours: true },
    });

    for (const config of configs) {
      const cutoff = new Date(Date.now() - config.autoConfirmHours * 60 * 60 * 1000);

      await this.prisma.appointment.updateMany({
        where: {
          companyId: config.companyId,
          status: AppointmentStatus.SCHEDULED,
          createdAt: { lte: cutoff },
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });
    }
  }

  private async processReminders(): Promise<void> {
    const configs = await this.prisma.whatsappConfig.findMany({
      where: { isConnected: true },
      select: {
        companyId: true,
        instanceName: true,
        reminderRules: true,
        reminderMessage: true,
        // Legacy fallback fields
        reminderHoursBefore: true,
        reminderDayBefore: true,
      },
    });

    const now = new Date();
    const windowMs = 5 * 60 * 1000; // 5-minute window

    for (const config of configs) {
      let rules: ReminderRule[] = Array.isArray(config.reminderRules)
        ? (config.reminderRules as unknown as ReminderRule[])
        : [];

      // Legacy fallback: if no rules configured, use old hoursBefore setting
      if (rules.length === 0) {
        rules = [{ minutesBefore: (config.reminderHoursBefore ?? 2) * 60 }];
        if (config.reminderDayBefore) {
          rules.push({ minutesBefore: 24 * 60 });
        }
      }

      const maxMinutes = Math.max(...rules.map((r) => r.minutesBefore));
      const daysAhead = Math.ceil(maxMinutes / 1440) + 1;

      // Collect unique dates to scan
      const datesToScan = new Set<string>();
      for (let i = 0; i <= daysAhead; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        datesToScan.add(localDateStr(d));
      }

      for (const dateStr of datesToScan) {
        const appointments = await this.prisma.appointment.findMany({
          where: {
            companyId: config.companyId,
            status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
            scheduledDate: utcDateRange(dateStr),
          },
          select: {
            id: true,
            clientId: true,
            scheduledTime: true,
            sentReminderMinutes: true,
            client: { select: { whatsappNumber: true, name: true } },
            service: { select: { name: true } },
            collaborator: { select: { name: true } },
          },
        });

        for (const appt of appointments) {
          // Parse appointment date/time considering the correct timezone
          const apptDateTime = toDate(`${dateStr}T${appt.scheduledTime}:00`, { timeZone: TIMEZONE });
          if (isNaN(apptDateTime.getTime())) continue;

          const sent = appt.sentReminderMinutes as number[];

          for (const rule of rules) {
            if (sent.includes(rule.minutesBefore)) continue;

            const sendAt = new Date(apptDateTime.getTime() - rule.minutesBefore * 60_000);

            // Send if sendAt falls within [now - windowMs/2, now + windowMs/2)
            const diff = now.getTime() - sendAt.getTime();
            if (diff < 0 || diff >= windowMs) continue;

            const dateFormatted = dateStr.split('-').reverse().join('/');
            const rawMsg = rule.message ?? config.reminderMessage;
            const message = rawMsg 
              ? rawMsg
                  .replace(/{\s*nome\s*}/gi, appt.client.name)
                  .replace(/{\s*servico\s*}/gi, appt.service.name)
                  .replace(/{\s*horario\s*}/gi, appt.scheduledTime)
                  .replace(/{\s*profissional\s*}/gi, appt.collaborator.name)
                  .replace(/{\s*data\s*}/gi, dateFormatted)
              : this.buildDefaultMessage(appt, dateStr, rule.minutesBefore);

            await this.notifications.enqueueWhatsapp({
              companyId: config.companyId,
              instanceName: config.instanceName,
              toNumber: appt.client.whatsappNumber,
              message,
              type: NotificationType.APPOINTMENT_REMINDER,
              clientId: appt.clientId,
            });

            await this.prisma.appointment.update({
              where: { id: appt.id },
              data: { sentReminderMinutes: { push: rule.minutesBefore } },
            });

            this.logger.log(
              `Lembrete ${rule.minutesBefore}min enviado para agendamento ${appt.id}`,
            );
          }
        }
      }
    }
  }

  private buildDefaultMessage(
    appt: { client: { name: string }; service: { name: string }; collaborator: { name: string }; scheduledTime: string },
    dateStr: string,
    minutesBefore: number,
  ): string {
    const when =
      minutesBefore >= 1440
        ? 'amanhã'
        : minutesBefore < 60
          ? `em ${minutesBefore} minutos`
          : minutesBefore === 60
            ? 'em 1 hora'
            : minutesBefore % 60 === 0
              ? `em ${minutesBefore / 60} horas`
              : `em ${Math.floor(minutesBefore / 60)}h${minutesBefore % 60}min`;

    return `Lembrete: ${appt.client.name}, você tem *${appt.service.name}* com ${appt.collaborator.name} no dia ${dateStr} às ${appt.scheduledTime} — ${when}.`;
  }
}
