import { Module } from '@nestjs/common';
import { BusinessHoursService } from './business-hours.service';
import { BusinessHoursController } from './business-hours.controller';

@Module({
  controllers: [BusinessHoursController],
  providers: [BusinessHoursService],
  exports: [BusinessHoursService],
})
export class BusinessHoursModule {}
