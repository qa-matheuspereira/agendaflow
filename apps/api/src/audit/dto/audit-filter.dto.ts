import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AuditAction } from '@agendaflow/shared';
import { PaginationDto } from '@/core/dto/pagination.dto';

export class AuditFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
