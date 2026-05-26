import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Queue')
@ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('state')
  @ApiOperation({ summary: 'Obter estado atual da fila' })
  getState(@CurrentTenant() companyId: string) {
    return this.queueService.getState(companyId);
  }

  @Post('join')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Adicionar cliente à fila' })
  joinQueue(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: JoinQueueDto,
  ) {
    return this.queueService.joinQueue(companyId, dto, userId);
  }

  @Post('next')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Chamar próximo da fila' })
  callNext(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Query('collaboratorId') collaboratorId?: string,
  ) {
    return this.queueService.callNext(companyId, collaboratorId, userId);
  }

  @Put('reorder')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Reordenar fila' })
  reorder(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderQueueDto,
  ) {
    return this.queueService.reorderQueue(companyId, dto, userId);
  }

  @Patch(':id/start')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Iniciar atendimento da entrada na fila' })
  startService(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.queueService.startService(companyId, id, userId);
  }

  @Patch(':id/finish')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Finalizar atendimento da entrada na fila' })
  finishService(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.queueService.finishService(companyId, id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover cliente da fila' })
  leaveQueue(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.queueService.leaveQueue(companyId, id, userId);
  }

  @Patch(':id/complete')
  @Roles(UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Concluir entrada na fila diretamente (qualquer status ativo)' })
  completeEntry(
    @CurrentTenant() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.queueService.completeEntry(companyId, id, userId);
  }
}
