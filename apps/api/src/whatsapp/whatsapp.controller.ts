import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '@/core/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import type {
  EvolutionWebhookPayload,
  EvolutionMessageData,
  EvolutionAckData,
} from './interfaces/evolution-payload.interface';

@ApiTags('WhatsApp Webhook')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly inboundService: WhatsappInboundService,
  ) {}

  /**
   * Recebe eventos da Evolution API.
   * Configure a URL no painel/API da Evolution: POST <host>/api/v1/whatsapp/webhook
   */
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
}
