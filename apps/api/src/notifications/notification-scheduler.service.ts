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

import { toDate, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

// Appointments are stored with scheduledDate as UTC midnight (new Date(dateStr + 'T00:00:00.000Z')).
// This range must match that convention — do NOT convert to São Paulo midnight.
function utcDateRange(dateStr: string) {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T00:00:00.000Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function localDateStr(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');
}

// Handles both ASCII {key} and full-width ｛key｝ braces (mobile/browser encoding variants)
function applyPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/[{｛]\s*(\w+)\s*[}｝]/gi, (_, key) => vars[key.toLowerCase()] ?? `{${key}}`);
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

    // Get current time in São Paulo (server may run in UTC)
    const [spHStr, spMStr] = formatInTimeZone(now, TIMEZONE, 'HH:mm').split(':');
    const spNowMinutes = Number(spHStr) * 60 + Number(spMStr);

    // Sentinel value used in sentReminderMinutes to track daily reminder sent for today
    const DAILY_SENTINEL = 1441;

    for (const config of configs) {
      const reminderTime = config.dailyReminderTime ?? '07:00';
      // Check if we're within the 5-minute window of the configured time
      const [rH, rM] = reminderTime.split(':').map(Number);
      const reminderMinutes = rH * 60 + rM;
      const nowMinutes = spNowMinutes;
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
          scheduledDate: true,
          scheduledTime: true,
          client: { select: { whatsappNumber: true, name: true } },
          service: { select: { name: true } },
          collaborator: { select: { name: true } },
        },
      });

      for (const appt of appointments) {
        const dateFormatted = formatInTimeZone(appt.scheduledDate, TIMEZONE, 'dd/MM/yyyy');
        const rawMsg = config.reminderMessage ?? '';
        const message = rawMsg.trim()
          ? applyPlaceholders(rawMsg, {
              nome: appt.client.name,
              servico: appt.service.name,
              horario: appt.scheduledTime,
              profissional: appt.collaborator.name,
              data: dateFormatted,
            })
          : `Olá, ${appt.client.name}! Lembrando que você tem *${appt.service.name}* com ${appt.collaborator.name} hoje às ${appt.scheduledTime}. Até logo!`;
        this.logger.debug(`[DailyReminder] appt=${appt.id} date=${dateFormatted} msg=${message.slice(0, 80)}`);

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
            this.logger.debug(`[Reminder] appt=${appt.id} rawMsg=${JSON.stringify(rawMsg)?.slice(0, 150)} time=${appt.scheduledTime} date=${dateFormatted}`);
            const message = rawMsg
              ? applyPlaceholders(rawMsg, {
                  nome: appt.client.name,
                  servico: appt.service.name,
                  horario: appt.scheduledTime,
                  profissional: appt.collaborator.name,
                  data: dateFormatted,
                })
              : this.buildDefaultMessage(appt, dateStr, rule.minutesBefore);

            this.logger.debug(`[Reminder] mensagem final (80 chars): ${message.slice(0, 80)}`);
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
