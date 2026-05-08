import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_WHATSAPP_NOTIFICATIONS } from '@agendaflow/shared';
import type { WhatsappNotificationJob } from '../notifications.service';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from '@/whatsapp/whatsapp.service';

@Processor(QUEUE_WHATSAPP_NOTIFICATIONS)
export class WhatsappNotificationProcessor {
  private readonly logger = new Logger(WhatsappNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Process()
  async process(job: Job<WhatsappNotificationJob>): Promise<void> {
    const { companyId, instanceName, toNumber, message, type, clientId, collaboratorId } = job.data;

    this.logger.debug(
      `Processando notificação ${type} → ${toNumber} (tentativa ${job.attemptsMade + 1})`,
    );

    const notification = await this.prisma.notification.create({
      data: {
        companyId,
        clientId: clientId ?? null,
        collaboratorId: collaboratorId ?? null,
        type,
        whatsappNumber: toNumber,
        message,
      },
    });

    try {
      const evolutionMsgId = await this.whatsapp.sendText(instanceName, toNumber, message);

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          sentAt: new Date(),
          evolutionMsgId: evolutionMsgId ?? undefined,
        },
      });
    } catch (error) {
      const failReason = error instanceof Error ? error.message : String(error);

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          failedAt: new Date(),
          failReason,
        },
      });

      // Re-throw so Bull records the failure and applies retry backoff.
      throw error;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<WhatsappNotificationJob>, error: Error) {
    this.logger.error(
      `Falha na notificação ${job.data.type} → ${job.data.toNumber} ` +
        `(tentativa ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<WhatsappNotificationJob>) {
    this.logger.log(
      `Notificação ${job.data.type} enviada: ${job.data.toNumber} (instância: ${job.data.instanceName})`,
    );
  }
}
