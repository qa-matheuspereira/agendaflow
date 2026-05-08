import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlockClientDto {
  @ApiProperty({ description: 'Motivo do bloqueio' })
  @IsString()
  @MinLength(5)
  reason!: string;
}
