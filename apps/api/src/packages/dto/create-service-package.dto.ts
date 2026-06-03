import { IsString, IsInt, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum, Min, Max } from 'class-validator';
import { CreditMode } from '@prisma/client';

export class CreateServicePackageDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  credits!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(365)
  validityDays!: number;

  @IsOptional()
  @IsEnum(CreditMode)
  creditMode?: CreditMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
