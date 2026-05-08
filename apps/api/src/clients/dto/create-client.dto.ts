import { IsString, IsOptional, IsEmail, IsDateString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Número WhatsApp no formato: 5511999999999' })
  @IsString()
  @Matches(/^55\d{10,11}$/, { message: 'Número deve estar no formato 5511999999999' })
  whatsappNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
