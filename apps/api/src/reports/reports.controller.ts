import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs do período (dateFrom/dateTo obrigatórios)' })
  getKpis(@CurrentTenant() companyId: string, @Query() filter: ReportFilterDto) {
    return this.service.getKpis(companyId, filter);
  }

  @Get('kpis/dashboard')
  @ApiOperation({ summary: 'KPIs do dashboard (hoje/semana/mês)' })
  getDashboardKpis(@CurrentTenant() companyId: string) {
    return this.service.getDashboardKpis(companyId);
  }

  @Get('by-service')
  @ApiOperation({ summary: 'Agendamentos agrupados por serviço' })
  byService(@CurrentTenant() companyId: string, @Query() filter: ReportFilterDto) {
    return this.service.getAppointmentsByService(companyId, filter);
  }

  @Get('by-collaborator')
  @ApiOperation({ summary: 'Agendamentos agrupados por colaborador' })
  byCollaborator(@CurrentTenant() companyId: string, @Query() filter: ReportFilterDto) {
    return this.service.getAppointmentsByCollaborator(companyId, filter);
  }

  @Get('queue')
  @ApiOperation({ summary: 'Estatísticas de fila do período' })
  queueStats(@CurrentTenant() companyId: string, @Query() filter: ReportFilterDto) {
    return this.service.getQueueStats(companyId, filter);
  }
}
