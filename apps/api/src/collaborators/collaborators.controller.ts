import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CollaboratorsService } from './collaborators.service';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';
import { PaginationDto } from '@/core/dto/pagination.dto';

@ApiTags('Collaborators')
@ApiBearerAuth()
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar colaborador' })
  create(
    @CurrentTenant() companyId: string,
    @Body() dto: CreateCollaboratorDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaboratorsService.create(companyId, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar colaboradores' })
  findAll(
    @CurrentTenant() companyId: string,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters = {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    };
    return this.collaboratorsService.findAll(companyId, pagination, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar colaborador por ID' })
  findOne(@CurrentTenant() companyId: string, @Param('id') id: string) {
    return this.collaboratorsService.findOne(companyId, id);
  }

  @Put(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Atualizar colaborador' })
  update(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCollaboratorDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaboratorsService.update(companyId, id, dto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar colaborador' })
  deactivate(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaboratorsService.deactivate(companyId, id, userId);
  }

  @Put(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reativar colaborador' })
  activate(
    @CurrentTenant() companyId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaboratorsService.activate(companyId, id, userId);
  }
}
