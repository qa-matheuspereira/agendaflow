import { IsUUID, IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { QueuePriority } from '@prisma/client';

export class JoinQueueDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @IsOptional()
  @IsEnum(QueuePriority)
  priority?: QueuePriority;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
