import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { GetAppointmentsDto } from './dto/get-appointments.dto';
import { GetSlotsDto } from '@/schedule-engine/dto/get-slots.dto';
import { ScheduleEngineService } from '@/schedule-engine/schedule-engine.service';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly scheduleEngine: ScheduleEngineService,
  ) {}

  @Get('slots')
  @ApiOperation({ summary: 'Listar horários disponíveis' })
  getSlots(@CurrentTenant() companyId: string, @Query() dto: GetSlotsDto) {
    return this.scheduleEngine.getAvailableSlots(companyId, dto);
  }

  @Post()
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Criar agendamento' })
  create(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.service.create(companyId, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar agendamentos' })
  findAll(
    @CurrentTenant() companyId: string,
    @Query() query: GetAppointmentsDto,
  ) {
    return this.service.findAll(companyId, query, {
      date: query.date,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      collaboratorId: query.collaboratorId,
      clientId: query.clientId,
      status: query.status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar agendamento por ID' })
  findOne(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Put(':id')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Atualizar agendamento' })
  update(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(companyId, id, dto, userId);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Confirmar agendamento' })
  confirm(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.confirm(companyId, id, userId);
  }

  @Patch(':id/start')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Iniciar atendimento' })
  start(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.start(companyId, id, userId);
  }

  @Patch(':id/complete')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Concluir atendimento' })
  complete(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.complete(companyId, id, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Cancelar agendamento' })
  cancel(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.cancel(companyId, id, dto, userId, true);
  }

  @Patch(':id/no-show')
  @Roles(UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar como não compareceu' })
  noShow(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.noShow(companyId, id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir agendamento (apenas cancelados/concluídos/falta)' })
  delete(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.delete(companyId, id, userId);
  }
}
