import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Roles } from '@/core/decorators/roles.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { UserRole } from '@agendaflow/shared';
import type { AuthenticatedUser } from '@agendaflow/shared';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[SUPER_ADMIN] Criar nova empresa/tenant' })
  create(@Body() dto: CreateCompanyDto, @CurrentUser('id') userId: string) {
    return this.companiesService.create(dto, userId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[SUPER_ADMIN] Listar todas as empresas' })
  findAll(@CurrentUser('id') userId: string) {
    return this.companiesService.findAll(userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Dados da empresa do tenant atual' })
  findMe(@CurrentTenant() companyId: string) {
    return this.companiesService.findOne(companyId);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Estatísticas rápidas do tenant' })
  getStats(@CurrentTenant() companyId: string) {
    return this.companiesService.getStats(companyId);
  }

  @Put('me')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar dados da empresa' })
  update(
    @CurrentTenant() companyId: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.companiesService.update(companyId, dto, userId);
  }
}
