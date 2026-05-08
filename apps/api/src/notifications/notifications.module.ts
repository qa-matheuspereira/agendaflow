import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import {
  QUEUE_WHATSAPP_NOTIFICATIONS,
  QUEUE_PAYMENT_PROCESSING,
  QUEUE_SCHEDULE_REMINDERS,
  QUEUE_AUTO_RULES,
} from '@agendaflow/shared';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { NotificationsService } from './notifications.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { WhatsappNotificationProcessor } from './processors/whatsapp-notification.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_WHATSAPP_NOTIFICATIONS },
      { name: QUEUE_PAYMENT_PROCESSING },
      { name: QUEUE_SCHEDULE_REMINDERS },
      { name: QUEUE_AUTO_RULES },
    ),
    WhatsappModule,
  ],
  providers: [NotificationsService, NotificationSchedulerService, WhatsappNotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
