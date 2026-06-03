import { IsString, IsOptional } from 'class-validator';

export class PurchasePackageDto {
  @IsString()
  packageId!: string;

  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
