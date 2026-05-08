import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { ScheduleEngineModule } from '@/schedule-engine/schedule-engine.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ClientsModule } from '@/clients/clients.module';

@Module({
  imports: [ScheduleEngineModule, NotificationsModule, ClientsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
