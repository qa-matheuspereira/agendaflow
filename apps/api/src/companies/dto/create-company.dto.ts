import { IsString, IsEmail, IsOptional, IsEnum, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchedulingMode } from '@agendaflow/shared';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Slug único: apenas letras minúsculas, números e hífens' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug deve conter apenas letras minúsculas, números e hífens' })
  slug!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ enum: SchedulingMode, default: SchedulingMode.HYBRID })
  @IsOptional()
  @IsEnum(SchedulingMode)
  schedulingMode?: SchedulingMode;

  @ApiPropertyOptional({ default: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
