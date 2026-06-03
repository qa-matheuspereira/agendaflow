import { Module, forwardRef } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import { WhatsappClientBotService } from './whatsapp-client-bot.service';
import { WhatsappCollaboratorBotService } from './whatsapp-collaborator-bot.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { ScheduleEngineModule } from '@/schedule-engine/schedule-engine.module';
import { PackagesModule } from '@/packages/packages.module';

@Module({
  imports: [ScheduleEngineModule, forwardRef(() => PackagesModule)],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappInboundService, WhatsappClientBotService, WhatsappCollaboratorBotService, WhatsappAiService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
