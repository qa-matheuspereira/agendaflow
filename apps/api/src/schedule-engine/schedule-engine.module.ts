import { Module } from '@nestjs/common';
import { ScheduleEngineService } from './schedule-engine.service';

@Module({
  providers: [ScheduleEngineService],
  exports: [ScheduleEngineService],
})
export class ScheduleEngineModule {}
