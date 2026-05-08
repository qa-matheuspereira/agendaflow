import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderQueueDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  orderedIds!: string[];
}
