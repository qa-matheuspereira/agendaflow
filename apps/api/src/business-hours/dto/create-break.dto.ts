import { IsDateString, IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateBreakDto {
  @IsUUID()
  collaboratorId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime deve ser HH:MM' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime deve ser HH:MM' })
  endTime!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
