import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadopagoService } from './mercadopago.service';

/**
 * Payments Module — Skeleton FASE 2
 * Implementação completa na FASE 6.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadopagoService],
  exports: [PaymentsService, MercadopagoService],
})
export class PaymentsModule {}
