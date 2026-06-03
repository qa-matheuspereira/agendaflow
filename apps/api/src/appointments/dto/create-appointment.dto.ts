import { IsDateString, IsString, IsUUID, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  collaboratorId!: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  scheduledDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'scheduledTime deve ser HH:MM' })
  scheduledTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  skipLock?: boolean;

  @IsOptional()
  @IsUUID()
  clientPackageId?: string;

  @IsOptional()
  @IsString()
  bookingSessionId?: string;

  @IsOptional()
  @IsUUID()
  packageOwnerId?: string;
}
