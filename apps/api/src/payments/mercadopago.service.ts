import * as crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/database/prisma.service';

export interface CreatePreferenceInput {
  companyId: string;
  title: string;
  amount: number;
  externalReference: string;
  notificationUrl: string;
  payerEmail?: string;
  expirationHours?: number;
}

export interface PreferenceResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

export interface PixPaymentResult {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: Date;
}

const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getCredentials(companyId: string) {
    const cfg = await this.prisma.mercadopagoConfig.findUnique({ where: { companyId } });
    if (!cfg?.isActive) throw new Error(`Mercado Pago não configurado para empresa ${companyId}`);
    return cfg;
  }

  /**
   * Validates Mercado Pago webhook signature.
   * Format: x-signature header = "ts=<epoch_ms>,v1=<hmac_hex>"
   * Manifest: "id:<data_id>;request-id:<x-request-id>;ts:<ts>;"
   * HMAC-SHA256 of manifest with MERCADO_PAGO_WEBHOOK_SECRET.
   * Returns true if secret not configured (unvalidated but accepted).
   */
  validateWebhookSignature(
    signatureHeader: string,
    requestId: string,
    dataId: string,
  ): boolean {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('MERCADO_PAGO_WEBHOOK_SECRET not set — webhook accepted without validation');
      return true;
    }

    if (!signatureHeader) return false;

    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) parts[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
    }

    const { ts, v1 } = parts;
    if (!ts || !v1) return false;

    // Replay protection: reject if timestamp is older than 5 minutes
    const tsMs = parseInt(ts, 10);
    if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > WEBHOOK_REPLAY_WINDOW_MS) {
      this.logger.warn(`Webhook timestamp out of window: ts=${ts}`);
      return false;
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(computed));
    } catch {
      // Buffer length mismatch — definitely invalid
      return false;
    }
  }

  async createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
    const credentials = await this.getCredentials(input.companyId);
    void credentials;
    // Full SDK integration in FASE 6
    return {
      preferenceId: 'placeholder-preference-id',
      initPoint: 'https://www.mercadopago.com.br/checkout/v1/redirect',
    };
  }

  async getPaymentStatus(companyId: string, paymentId: string): Promise<string> {
    const credentials = await this.getCredentials(companyId);
    void credentials;
    void paymentId;
    return 'pending';
  }
}
