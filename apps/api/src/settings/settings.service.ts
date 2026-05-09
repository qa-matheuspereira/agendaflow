import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction } from '@agendaflow/shared';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import { UpdateWhatsappConfigDto } from './dto/update-whatsapp-config.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private readonly evolutionUrl: string;
  private readonly evolutionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.evolutionUrl = this.config.get<string>('evolution.apiUrl') ?? 'http://localhost:8080';
    this.evolutionKey = this.config.get<string>('evolution.apiKey') ?? '';
    this.logger.log(`Evolution API URL: ${this.evolutionUrl}`);
    this.logger.log(`Evolution API Key: ${this.evolutionKey ? '***' + this.evolutionKey.slice(-4) : 'NOT SET'}`);
  }

  async getBusinessRules(companyId: string) {
    const [rules, company] = await Promise.all([
      this.prisma.businessRules.findUnique({ where: { companyId } }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { schedulingMode: true } }),
    ]);
    if (!rules) throw new NotFoundException('Regras de negócio não encontradas');
    return { ...rules, schedulingMode: company?.schedulingMode ?? 'HYBRID' };
  }

  async updateBusinessRules(companyId: string, dto: UpdateBusinessRulesDto, userId: string) {
    const existing = await this.prisma.businessRules.findUnique({ where: { companyId } });
    if (!existing) throw new NotFoundException('Regras de negócio não encontradas');

    const [updated] = await Promise.all([
      this.prisma.businessRules.update({
        where: { companyId },
        data: {
          cancellationAllowed: dto.cancellationAllowed,
          cancellationMinHours: dto.cancellationMinHours,
          autoBlockEnabled: dto.autoBlockEnabled,
          autoBlockAfterAbsences: dto.autoBlockAfterAbsences,
          autoBlockWindowDays: dto.autoBlockWindowDays,
          autoBlockDurationDays: dto.autoBlockDurationDays,
          autoReturnEnabled: dto.autoReturnEnabled,
          autoReturnAfterDays: dto.autoReturnAfterDays,
          autoReturnMessage: dto.autoReturnMessage,
          requireConfirmation: dto.requireConfirmation,
          confirmationDeadlineHours: dto.confirmationDeadlineHours,
        },
      }),
      ...(dto.schedulingMode
        ? [this.prisma.company.update({ where: { id: companyId }, data: { schedulingMode: dto.schedulingMode } })]
        : []),
    ]);

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'BusinessRules',
      entityId: existing.id,
      oldValue: {
        cancellationMinHours: existing.cancellationMinHours,
        autoBlockEnabled: existing.autoBlockEnabled,
      },
      newValue: dto as unknown as Record<string, unknown>,
    });

    return { ...updated, schedulingMode: dto.schedulingMode ?? 'HYBRID' };
  }

  async getWhatsappConfig(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: {
        id: true,
        companyId: true,
        instanceName: true,
        isConnected: true,
        phoneNumber: true,
        greetingMessage: true,
        scheduleConfirmMsg: true,
        reminderMessage: true,
        cancellationMessage: true,
        queueCalledMessage: true,
        reminderRules: true,
        autoConfirmEnabled: true,
        autoConfirmHours: true,
        dailyReminderEnabled: true,
        dailyReminderTime: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');
    return config;
  }

  async updateWhatsappConfig(companyId: string, dto: UpdateWhatsappConfigDto, userId: string) {
    const existing = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!existing) throw new NotFoundException('Configuração WhatsApp não encontrada');

    const updated = await this.prisma.whatsappConfig.update({
      where: { companyId },
      data: {
        greetingMessage: dto.greetingMessage,
        scheduleConfirmMsg: dto.scheduleConfirmMsg,
        reminderMessage: dto.reminderMessage,
        cancellationMessage: dto.cancellationMessage,
        queueCalledMessage: dto.queueCalledMessage,
        ...(dto.reminderRules !== undefined ? { reminderRules: JSON.parse(JSON.stringify(dto.reminderRules)) } : {}),
        ...(dto.autoConfirmEnabled !== undefined ? { autoConfirmEnabled: dto.autoConfirmEnabled } : {}),
        ...(dto.autoConfirmHours !== undefined ? { autoConfirmHours: dto.autoConfirmHours } : {}),
        ...(dto.dailyReminderEnabled !== undefined ? { dailyReminderEnabled: dto.dailyReminderEnabled } : {}),
        ...(dto.dailyReminderTime !== undefined ? { dailyReminderTime: dto.dailyReminderTime } : {}),
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'WhatsappConfig',
      entityId: existing.id,
      newValue: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  private evoHeaders() {
    return { apikey: this.evolutionKey, 'Content-Type': 'application/json' };
  }

  async getConnectionStatus(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    try {
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connectionState/${config.instanceName}`,
        { headers: this.evoHeaders(), timeout: 5000 },
      );
      const state = res.data?.instance?.state ?? res.data?.state ?? 'close';
      const connected = state === 'open';

      if (config.isConnected !== connected) {
        await this.prisma.whatsappConfig.update({
          where: { companyId },
          data: { isConnected: connected },
        });
      }

      return { instanceName: config.instanceName, connected, state, phoneNumber: config.phoneNumber };
    } catch {
      return { instanceName: config.instanceName, connected: false, state: 'close', phoneNumber: config.phoneNumber };
    }
  }

  async generateQr(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    const headers = this.evoHeaders();
    const instanceName = config.instanceName;
    this.logger.log(`[QR] Início para ${instanceName} | URL: ${this.evolutionUrl}`);

    // 1) Tentar connect (retorna QR se instância existe e está desconectada)
    const connectQr = await this.evoConnect(instanceName, headers);
    if (connectQr.qrcode) return connectQr;

    // 2) Se connect falhou com 404, criar instância nova
    if (connectQr.notFound) {
      return this.evoCreateInstance(instanceName, headers);
    }

    // 3) Connect deu 200 mas sem QR — instância pode estar presa
    //    Deletar e recriar
    this.logger.warn(`[QR] Instância ${instanceName} sem QR no connect. Deletando e recriando...`);
    await this.evoDeleteInstance(instanceName, headers);

    // Aguardar 2s para a Evolution processar
    await new Promise((r) => setTimeout(r, 2000));

    return this.evoCreateInstance(instanceName, headers);
  }

  private extractQrBase64(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    // Evolution v2 retorna em diversos formatos dependendo do endpoint
    // /instance/connect → { base64: "data:image/..." }
    // /instance/create  → { qrcode: { base64: "data:image/..." } }
    // /instance/qrcode  → { base64: "data:image/..." } ou { qrcode: { base64: "..." } }
    const candidates = [
      d.base64,
      (d.qrcode as Record<string, unknown>)?.base64,
      d.code, // string QR code (não imagem)
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 50) return c;
    }
    return null;
  }

  private async evoConnect(
    instanceName: string,
    headers: Record<string, string>,
  ): Promise<{ qrcode: string | null; notFound?: boolean; error?: string }> {
    try {
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connect/${instanceName}`,
        { headers, timeout: 15000 },
      );
      this.logger.log(`[QR] connect ${instanceName} → ${res.status} | keys: ${Object.keys(res.data ?? {})}`);
      this.logger.debug(`[QR] connect data: ${JSON.stringify(res.data).slice(0, 500)}`);

      const base64 = this.extractQrBase64(res.data);
      if (base64) {
        this.logger.log(`[QR] ✅ QR obtido via connect (${base64.length} chars)`);
        return { qrcode: base64 };
      }
      return { qrcode: null };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const body = err.response?.data;
        this.logger.warn(`[QR] connect ${instanceName} falhou: status=${status} body=${JSON.stringify(body).slice(0, 300)}`);

        if (status === 404) return { qrcode: null, notFound: true };
        if (!err.response) return { qrcode: null, error: 'Evolution API inacessível' };
      }
      return { qrcode: null, error: 'Erro no connect' };
    }
  }

  private async evoCreateInstance(
    instanceName: string,
    headers: Record<string, string>,
  ): Promise<{ qrcode: string | null; error?: string }> {
    try {
      this.logger.log(`[QR] Criando instância ${instanceName}...`);
      const res = await axios.post(
        `${this.evolutionUrl}/instance/create`,
        {
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          token: this.evolutionKey,
          qrcode: true,
        },
        { headers, timeout: 20000 },
      );
      this.logger.log(`[QR] create ${instanceName} → ${res.status} | keys: ${Object.keys(res.data ?? {})}`);
      this.logger.debug(`[QR] create data: ${JSON.stringify(res.data).slice(0, 500)}`);

      const base64 = this.extractQrBase64(res.data);
      if (base64) {
        this.logger.log(`[QR] ✅ QR obtido via create (${base64.length} chars)`);
        return { qrcode: base64 };
      }

      // QR pode não vir no create — tentar connect logo após
      this.logger.log(`[QR] Create OK mas sem QR. Tentando connect...`);
      await new Promise((r) => setTimeout(r, 1500));
      const connectResult = await this.evoConnect(instanceName, headers);
      if (connectResult.qrcode) return connectResult;

      return { qrcode: null, error: 'Instância criada mas QR não disponível. Clique novamente.' };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data;
        const status = err.response?.status;
        this.logger.error(`[QR] create falhou: status=${status} body=${JSON.stringify(body).slice(0, 500)}`);

        // "already in use" → deletar e recriar
        if (status === 403 || (status === 400 && JSON.stringify(body).includes('already'))) {
          this.logger.warn(`[QR] Instância ${instanceName} já existe. Deletando e recriando...`);
          await this.evoDeleteInstance(instanceName, headers);
          await new Promise((r) => setTimeout(r, 2000));

          // Tentar criar de novo (sem recursão infinita — apenas 1 retry)
          try {
            const retryRes = await axios.post(
              `${this.evolutionUrl}/instance/create`,
              {
                instanceName,
                integration: 'WHATSAPP-BAILEYS',
                token: this.evolutionKey,
                qrcode: true,
              },
              { headers, timeout: 20000 },
            );
            this.logger.log(`[QR] retry create → ${retryRes.status}`);
            const base64 = this.extractQrBase64(retryRes.data);
            if (base64) return { qrcode: base64 };

            // Último recurso: connect
            await new Promise((r) => setTimeout(r, 1500));
            return this.evoConnect(instanceName, headers);
          } catch (retryErr: unknown) {
            const retryMsg = axios.isAxiosError(retryErr)
              ? JSON.stringify(retryErr.response?.data)
              : String(retryErr);
            this.logger.error(`[QR] retry create falhou: ${retryMsg}`);
            return { qrcode: null, error: 'Falha ao recriar instância após cleanup' };
          }
        }

        return { qrcode: null, error: `Falha ao criar instância (${status})` };
      }
      return { qrcode: null, error: 'Erro inesperado ao criar instância' };
    }
  }

  private async evoDeleteInstance(instanceName: string, headers: Record<string, string>): Promise<void> {
    try {
      // Evolution v2 usa DELETE /instance/delete/{name}
      await axios.delete(
        `${this.evolutionUrl}/instance/delete/${instanceName}`,
        { headers, timeout: 10000 },
      );
      this.logger.log(`[QR] Instância ${instanceName} deletada`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        this.logger.warn(`[QR] delete ${instanceName} falhou: ${err.response?.status}`);
      }
    }
  }

  async disconnectWhatsapp(companyId: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    try {
      await axios.delete(
        `${this.evolutionUrl}/instance/logout/${config.instanceName}`,
        { headers: this.evoHeaders(), timeout: 5000 },
      );
    } catch {
      // ignore — update DB regardless
    }

    await this.prisma.whatsappConfig.update({
      where: { companyId },
      data: { isConnected: false },
    });

    return { disconnected: true };
  }
}
