import { IsDateString, IsUUID, IsOptional } from 'class-validator';

export class GetSlotsDto {
  @IsDateString()
  date!: string;

  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;
}
