import { IsEnum, IsString, IsBoolean, IsOptional, IsInt, IsUUID, Min, Max, Matches } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreateBusinessHourDto {
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime deve ser HH:MM' })
  openTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime deve ser HH:MM' })
  closeTime!: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  slotDurationMin?: number;
}
