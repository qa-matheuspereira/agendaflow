import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessHoursService } from './business-hours.service';
import { CreateBusinessHourDto } from './dto/create-business-hour.dto';
import { CreateSpecialDayDto } from './dto/create-special-day.dto';
import { CreateBreakDto } from './dto/create-break.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Business Hours')
@ApiBearerAuth()
@Controller('business-hours')
export class BusinessHoursController {
  constructor(private readonly service: BusinessHoursService) {}

  @Post('hours')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Upsert horário de funcionamento' })
  upsertHour(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBusinessHourDto,
  ) {
    return this.service.upsertBusinessHour(companyId, dto, userId);
  }

  @Get('hours')
  @ApiOperation({ summary: 'Listar horários de funcionamento' })
  getHours(
    @CurrentTenant() companyId: string,
    @Query('collaboratorId') collaboratorId?: string,
  ) {
    return this.service.findBusinessHours(companyId, collaboratorId);
  }

  @Post('special-days')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar dia especial / feriado' })
  createSpecialDay(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSpecialDayDto,
  ) {
    return this.service.createSpecialDay(companyId, dto, userId);
  }

  @Get('special-days')
  @ApiOperation({ summary: 'Listar dias especiais' })
  getSpecialDays(
    @CurrentTenant() companyId: string,
    @Query('year', ParseIntPipe) year: number,
    @Query('month') month?: string,
  ) {
    return this.service.findSpecialDays(companyId, year, month ? parseInt(month, 10) : undefined);
  }

  @Delete('special-days/:id')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover dia especial' })
  deleteSpecialDay(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteSpecialDay(companyId, id, userId);
  }

  @Post('breaks')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Criar pausa de colaborador' })
  createBreak(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBreakDto,
  ) {
    return this.service.createBreak(companyId, dto, userId);
  }

  @Get('breaks')
  @ApiOperation({ summary: 'Listar pausas' })
  getBreaks(
    @CurrentTenant() companyId: string,
    @Query('collaboratorId') collaboratorId?: string,
    @Query('date') date?: string,
  ) {
    return this.service.findBreaks(companyId, collaboratorId, date);
  }

  @Delete('breaks/:id')
  @Roles(UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover pausa' })
  deleteBreak(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteBreak(companyId, id, userId);
  }
}
