import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { SchedulingMode } from '@prisma/client';

export class UpdateBusinessRulesDto {
  @IsOptional()
  @IsEnum(SchedulingMode)
  schedulingMode?: SchedulingMode;
  @IsOptional()
  @IsBoolean()
  cancellationAllowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  cancellationMinHours?: number;

  @IsOptional()
  @IsBoolean()
  autoBlockEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  autoBlockAfterAbsences?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  autoBlockWindowDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  autoBlockDurationDays?: number;

  @IsOptional()
  @IsBoolean()
  autoReturnEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  autoReturnAfterDays?: number;

  @IsOptional()
  @IsString()
  autoReturnMessage?: string;

  @IsOptional()
  @IsBoolean()
  requireConfirmation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  confirmationDeadlineHours?: number;
}
