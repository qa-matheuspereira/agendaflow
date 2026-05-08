import { Module } from '@nestjs/common';
import { QueueGateway } from './queue.gateway';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuthModule } from '@/auth/auth.module';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [QueueController],
  providers: [QueueGateway, QueueService],
  exports: [QueueGateway, QueueService],
})
export class QueueModule {}
