import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { BlockClientDto } from './dto/block-client.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';
import { PaginationDto } from '@/core/dto/pagination.dto';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ClientFiltersDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isBlocked?: boolean;
}

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Criar cliente' })
  create(
    @CurrentTenant() companyId: string,
    @Body() dto: CreateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.create(companyId, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes com filtros e paginação' })
  findAll(@CurrentTenant() companyId: string, @Query() filters: ClientFiltersDto) {
    return this.clientsService.findAll(companyId, filters, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar cliente por ID com histórico' })
  findOne(@CurrentTenant() companyId: string, @Param('id') id: string) {
    return this.clientsService.findOne(companyId, id);
  }

  @Put(':id')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Atualizar dados do cliente' })
  update(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.update(companyId, id, dto, userId);
  }

  @Put(':id/block')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Bloquear cliente' })
  block(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @Body() dto: BlockClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.block(companyId, id, dto, userId);
  }

  @Put(':id/unblock')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Desbloquear cliente' })
  unblock(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.unblock(companyId, id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir cliente (sem agendamentos ativos)' })
  delete(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.delete(companyId, id, userId);
  }
}
