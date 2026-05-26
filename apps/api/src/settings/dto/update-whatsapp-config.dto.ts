import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReminderRuleDto {
  @IsInt()
  @Min(1)
  @Max(10080) // max 1 week in minutes
  minutesBefore!: number;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateWhatsappConfigDto {
  @IsOptional()
  @IsString()
  greetingMessage?: string;

  @IsOptional()
  @IsString()
  scheduleConfirmMsg?: string;

  @IsOptional()
  @IsString()
  reminderMessage?: string;

  @IsOptional()
  @IsString()
  cancellationMessage?: string;

  @IsOptional()
  @IsString()
  queueCalledMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReminderRuleDto)
  reminderRules?: ReminderRuleDto[];

  @IsOptional()
  @IsBoolean()
  autoConfirmEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  autoConfirmHours?: number;

  @IsOptional()
  @IsBoolean()
  dailyReminderEnabled?: boolean;

  @IsOptional()
  @IsString()
  dailyReminderTime?: string;

  @IsOptional()
  @IsString()
  dailyReminderMessage?: string;

  @IsOptional()
  @IsBoolean()
  skipCollaboratorSelection?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultipleServices?: boolean;
}
