import {
  IsString, IsOptional, IsBoolean, IsEmail, MinLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCollaboratorDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Número WhatsApp no formato: 5511999999999' })
  @IsString()
  @Matches(/^55\d{10,11}$/, { message: 'Número deve estar no formato E.164 sem +: 5511999999999' })
  whatsappNumber!: string;

  @ApiPropertyOptional({ description: 'WhatsApp @lid interno (preenchido automaticamente pelo bot ou manualmente pelo admin)' })
  @IsOptional()
  @IsString()
  whatsappLid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs dos serviços que este colaborador executa' })
  @IsOptional()
  serviceIds?: string[];

  // Permissões WhatsApp
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canViewSchedule?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canCreateSchedule?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canEditSchedule?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canDeleteSchedule?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canCreateBreak?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canCallNextQueue?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canFinishService?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hideFromBot?: boolean;
}
