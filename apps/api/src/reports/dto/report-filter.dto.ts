import { IsDateString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class ReportFilterDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
