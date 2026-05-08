import { IsDateString, IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateSpecialDayDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  isHoliday?: boolean;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime deve ser HH:MM' })
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime deve ser HH:MM' })
  closeTime?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;
}
