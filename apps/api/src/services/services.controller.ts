import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';
import { PaginationDto } from '@/core/dto/pagination.dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  @Post('categories')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar categoria de serviço' })
  createCategory(
    @CurrentTenant() companyId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.createCategory(companyId, dto, userId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorias' })
  findAllCategories(@CurrentTenant() companyId: string) {
    return this.servicesService.findAllCategories(companyId);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir categoria (sem serviços vinculados)' })
  deleteCategory(@CurrentTenant() companyId: string, @Param('id') id: string) {
    return this.servicesService.deleteCategory(companyId, id);
  }

  // ─── Services ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar serviço' })
  create(
    @CurrentTenant() companyId: string,
    @Body() dto: CreateServiceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.create(companyId, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar serviços' })
  findAll(
    @CurrentTenant() companyId: string,
    @Query() pagination: PaginationDto,
    @Query('onlyActive') onlyActive?: string,
    @Query('search') search?: string,
  ) {
    return this.servicesService.findAll(companyId, pagination, {
      onlyActive: onlyActive === 'true',
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar serviço por ID' })
  findOne(@CurrentTenant() companyId: string, @Param('id') id: string) {
    return this.servicesService.findOne(companyId, id);
  }

  @Put(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Atualizar serviço' })
  update(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.update(companyId, id, dto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar serviço' })
  deactivate(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.deactivate(companyId, id, userId);
  }

  @Put(':id/activate')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Reativar serviço' })
  activate(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.activate(companyId, id, userId);
  }
}
