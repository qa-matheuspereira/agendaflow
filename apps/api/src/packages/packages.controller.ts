import {
  Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreateServicePackageDto } from './dto/create-service-package.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Packages')
@ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  // ─── ServicePackage (catálogo) ────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar pacotes da empresa' })
  listPackages(@CurrentTenant() companyId: string) {
    return this.packagesService.listPackages(companyId);
  }

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar pacote' })
  createPackage(@CurrentTenant() companyId: string, @Body() dto: CreateServicePackageDto) {
    return this.packagesService.createPackage(companyId, dto);
  }

  @Put(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Atualizar pacote' })
  updatePackage(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateServicePackageDto>,
  ) {
    return this.packagesService.updatePackage(companyId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar pacote' })
  deactivatePackage(@CurrentTenant() companyId: string, @Param('id') id: string) {
    return this.packagesService.deactivatePackage(companyId, id);
  }

  // ─── ClientPackage ────────────────────────────────────────────────────────

  @Get('clients')
  @ApiOperation({ summary: 'Listar todos pacotes ativos de clientes' })
  listActiveClientPackages(@CurrentTenant() companyId: string) {
    return this.packagesService.listActiveClientPackages(companyId);
  }

  @Get('clients/:clientId')
  @ApiOperation({ summary: 'Listar pacotes ativos de um cliente' })
  getClientPackages(
    @CurrentTenant() companyId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.packagesService.getClientPackages(companyId, clientId);
  }

  @Post('purchase')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Ativar pacote para cliente (compra manual)' })
  purchasePackage(@CurrentTenant() companyId: string, @Body() dto: PurchasePackageDto) {
    return this.packagesService.purchasePackage(companyId, dto);
  }

  @Delete('clients/:clientPackageId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar pacote de cliente' })
  cancelClientPackage(
    @CurrentTenant() companyId: string,
    @Param('clientPackageId') clientPackageId: string,
  ) {
    return this.packagesService.cancelClientPackage(companyId, clientPackageId);
  }

  @Post('clients/:clientPackageId/extend')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Estender validade do pacote' })
  extendClientPackage(
    @CurrentTenant() companyId: string,
    @Param('clientPackageId') clientPackageId: string,
    @Body('days') days: number,
  ) {
    return this.packagesService.extendClientPackage(companyId, clientPackageId, days);
  }
}
