import {
  IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min, Max, IsPositive, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID da categoria' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Duração em minutos' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  durationMinutes!: number;

  @ApiPropertyOptional({ default: 0, description: 'Pausa após atendimento em minutos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  breakAfterMinutes?: number;

  @ApiProperty({ description: 'Preço do serviço' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresDocument?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentInstruction?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresAdvancePayment?: boolean;

  @ApiPropertyOptional({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsOptional()
  @IsEnum(['PERCENTAGE', 'FIXED'])
  advancePaymentType?: 'PERCENTAGE' | 'FIXED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  advancePaymentValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  maxDailyAppointments?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional({ enum: ['SCHEDULE', 'QUEUE'], default: 'SCHEDULE' })
  @IsOptional()
  @IsEnum(['SCHEDULE', 'QUEUE'])
  schedulingMode?: 'SCHEDULE' | 'QUEUE';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoDistribute?: boolean;
}
