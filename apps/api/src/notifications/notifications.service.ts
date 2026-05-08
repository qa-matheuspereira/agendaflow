import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  QUEUE_WHATSAPP_NOTIFICATIONS,
  QUEUE_SCHEDULE_REMINDERS,
  NotificationType,
} from '@agendaflow/shared';

export interface WhatsappNotificationJob {
  companyId: string;
  instanceName: string;
  toNumber: string;
  message: string;
  type: NotificationType;
  clientId?: string;
  collaboratorId?: string;
}

export interface ScheduleReminderJob {
  companyId: string;
  appointmentId: string;
  reminderType: 'DAY_BEFORE' | 'HOURS_BEFORE';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(QUEUE_WHATSAPP_NOTIFICATIONS)
    private readonly whatsappQueue: Queue<WhatsappNotificationJob>,
    @InjectQueue(QUEUE_SCHEDULE_REMINDERS)
    private readonly remindersQueue: Queue<ScheduleReminderJob>,
  ) {}

  async enqueueWhatsapp(job: WhatsappNotificationJob, priority: number = 5): Promise<void> {
    await this.whatsappQueue.add(job, {
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.debug(
      `Notificação enfileirada: ${job.type} → ${job.toNumber} (empresa: ${job.companyId})`,
    );
  }

  async enqueueReminder(job: ScheduleReminderJob): Promise<void> {
    await this.remindersQueue.add(job, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: 50,
    });
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.whatsappQueue.getWaitingCount(),
      this.whatsappQueue.getActiveCount(),
      this.whatsappQueue.getCompletedCount(),
      this.whatsappQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}
