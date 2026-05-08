import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
