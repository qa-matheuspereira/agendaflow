import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(OmitType(CreateCompanyDto, ['slug'] as const)) {}
