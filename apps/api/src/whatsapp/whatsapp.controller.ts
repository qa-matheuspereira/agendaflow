import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/core/decorators/public.decorator';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import { PrismaService } from '@/core/database/prisma.service';
import type {
  EvolutionWebhookPayload,
  EvolutionMessageData,
  EvolutionAckData,
} from './interfaces/evolution-payload.interface';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly inboundService: WhatsappInboundService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(@Body() payload: unknown) {
    const evt = payload as EvolutionWebhookPayload;

    const instanceName = evt.instance;
    if (!instanceName) return { received: true };

    const event = evt.event;
    this.logger.debug(
      `Webhook Evolution: ${event} | ${instanceName} | ${JSON.stringify(evt).slice(0, 400)}`,
    );

    try {
      if (event === 'messages.upsert') {
        await this.inboundService.processMessage(instanceName, evt.data as EvolutionMessageData);
      } else if (event === 'messages.update') {
        const updates = Array.isArray(evt.data)
          ? (evt.data as EvolutionAckData[])
          : [evt.data as EvolutionAckData];
        for (const upd of updates) {
          await this.inboundService.processDeliveryUpdate(instanceName, upd);
        }
      } else if (event === 'connection.update') {
        await this.whatsappService.processStatusUpdate(evt);
      }
    } catch (error) {
      this.logger.error(`Erro evento ${event} (${instanceName}):`, error);
    }

    return { received: true };
  }

  // ─── Bot disable/enable per conversation ─────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch('bot/:whatsappNumber')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ativar/desativar bot para um número' })
  async toggleBot(
    @CurrentTenant() companyId: string,
    @Param('whatsappNumber') whatsappNumber: string,
    @Body('disabled') disabled: boolean,
  ) {
    await this.prisma.conversationState.upsert({
      where: { companyId_whatsappNumber: { companyId, whatsappNumber } },
      create: {
        companyId,
        whatsappNumber,
        currentStep: 'IDLE',
        context: {},
        botDisabled: disabled,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      update: { botDisabled: disabled },
    });
    return { whatsappNumber, botDisabled: disabled };
  }

  @UseGuards(JwtAuthGuard)
  @Get('bot/disabled')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar conversas com bot desativado' })
  async listDisabledBots(@CurrentTenant() companyId: string) {
    return this.prisma.conversationState.findMany({
      where: { companyId, botDisabled: true },
      select: { whatsappNumber: true, updatedAt: true },
    });
  }
}
