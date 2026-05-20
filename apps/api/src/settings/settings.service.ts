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
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.evolutionUrl = this.config.get<string>('evolution.apiUrl') ?? 'http://localhost:8080';
    this.evolutionKey = this.config.get<string>('evolution.apiKey') ?? '';
    // API_BASE_URL or fall back to PORT-based localhost
    const port = this.config.get<number>('port') ?? 3001;
    const prefix = this.config.get<string>('apiPrefix') ?? 'api/v1';
    this.apiBaseUrl = this.config.get<string>('apiBaseUrl') ?? `http://localhost:${port}/${prefix}`;
    this.logger.log(`Evolution API URL: ${this.evolutionUrl}`);
    this.logger.log(`Webhook base URL: ${this.apiBaseUrl}`);
  }

  async getBusinessRules(companyId: string) {
    let rules = await this.prisma.businessRules.findUnique({ where: { companyId } });
    if (!rules) {
      rules = await this.prisma.businessRules.create({ data: { companyId } });
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { schedulingMode: true } });
    return { ...rules, schedulingMode: company?.schedulingMode ?? 'HYBRID' };
  }

  async updateBusinessRules(companyId: string, dto: UpdateBusinessRulesDto, userId: string) {
    let existing = await this.prisma.businessRules.findUnique({ where: { companyId } });
    if (!existing) {
      existing = await this.prisma.businessRules.create({ data: { companyId } });
    }

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
        skipCollaboratorSelection: true,
        allowMultipleServices: true,
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
        ...(dto.skipCollaboratorSelection !== undefined ? { skipCollaboratorSelection: dto.skipCollaboratorSelection } : {}),
        ...(dto.allowMultipleServices !== undefined ? { allowMultipleServices: dto.allowMultipleServices } : {}),
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

    const h = this.evoHeaders();
    const name = config.instanceName;
    this.logger.warn(`[QR] ▶ Início para ${name} | evoURL: ${this.evolutionUrl}`);

    // 1) Deletar instância existente (limpar estado preso)
    try {
      const del = await axios.delete(`${this.evolutionUrl}/instance/delete/${name}`, { headers: h, timeout: 10000 });
      this.logger.warn(`[QR] DELETE ${name} → ${del.status}`);
    } catch (e: unknown) {
      const s = axios.isAxiosError(e) ? e.response?.status ?? 'NO_RESP' : 'ERR';
      this.logger.warn(`[QR] DELETE ${name} → ${s} (ok, pode não existir)`);
    }

    // 2) Aguardar Evolution processar
    await new Promise((r) => setTimeout(r, 2000));

    // 3) Criar instância nova
    try {
      const webhookUrl = this.apiBaseUrl?.startsWith('http')
        ? `${this.apiBaseUrl}/whatsapp/webhook`
        : null;
      this.logger.warn(`[QR] Webhook URL: ${webhookUrl ?? 'NÃO CONFIGURADO (API_BASE_URL ausente)'}`);

      const createPayload: Record<string, unknown> = {
        instanceName: name,
        // token omitido — Evolution API gera automaticamente (evita conflito "token já existe")
        qrcode: true,
      };
      if (webhookUrl) {
        createPayload.webhook = webhookUrl;
        createPayload.webhook_by_events = false;
        createPayload.events = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
      }

      const res = await axios.post(
        `${this.evolutionUrl}/instance/create`,
        createPayload,
        { headers: h, timeout: 30000 },
      );
      this.logger.warn(`[QR] CREATE ${name} → ${res.status} | keys: ${Object.keys(res.data ?? {})} | dataLen: ${JSON.stringify(res.data).length}`);
      this.logger.warn(`[QR] CREATE data: ${JSON.stringify(res.data).slice(0, 800)}`);

      const qr = this.findQr(res.data);
      if (qr) {
        this.logger.warn(`[QR] ✅ QR obtido via CREATE (${qr.length} chars)`);
        return { qrcode: qr };
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? `status=${e.response?.status} body=${JSON.stringify(e.response?.data).slice(0, 500)}`
        : String(e);
      this.logger.error(`[QR] CREATE falhou: ${msg}`);
      return { qrcode: null, error: `Falha ao criar instância: ${msg}` };
    }

    // 4) QR não veio no create — poll connect até 12x (48s)
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 4000));

      // Tenta /instance/connect primeiro
      try {
        const res = await axios.get(
          `${this.evolutionUrl}/instance/connect/${name}`,
          { headers: h, timeout: 15000 },
        );
        this.logger.warn(`[QR] CONNECT[${i}] ${name} → ${res.status} | data: ${JSON.stringify(res.data)}`);

        const qr = this.findQr(res.data);
        if (qr) {
          this.logger.warn(`[QR] ✅ QR via CONNECT[${i}] (${qr.length} chars)`);
          return { qrcode: qr };
        }
      } catch (e: unknown) {
        const msg = axios.isAxiosError(e) ? `${e.response?.status}` : String(e);
        this.logger.warn(`[QR] CONNECT[${i}] erro: ${msg}`);
      }

      // Tenta /instance/qrcode/base64 como alternativa
      try {
        const res = await axios.get(
          `${this.evolutionUrl}/instance/qrcode/base64/${name}`,
          { headers: h, timeout: 10000 },
        );
        this.logger.warn(`[QR] QRCODE[${i}] ${name} → ${res.status} | data: ${JSON.stringify(res.data).slice(0, 400)}`);

        const qr = this.findQr(res.data);
        if (qr) {
          this.logger.warn(`[QR] ✅ QR via QRCODE[${i}] (${qr.length} chars)`);
          return { qrcode: qr };
        }
      } catch (e: unknown) {
        const msg = axios.isAxiosError(e) ? `${e.response?.status}` : String(e);
        this.logger.warn(`[QR] QRCODE[${i}] erro: ${msg}`);
      }
    }

    this.logger.error(`[QR] ❌ Não foi possível obter QR após delete + create + 12x connect`);
    return { qrcode: null, error: 'QR não disponível. Verifique os logs da Evolution API.' };
  }

  /** Tenta extrair QR base64 de qualquer formato da Evolution API v2 */
  private findQr(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    const candidates = [
      d.base64,
      (d.qrcode as Record<string, unknown>)?.base64,
      d.code,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 50) return c;
    }
    // Deep search — some versions nest in .instance or .data
    for (const key of Object.keys(d)) {
      const val = d[key];
      if (val && typeof val === 'object') {
        const nested = this.findQr(val);
        if (nested) return nested;
      }
    }
    return null;
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

  async generatePairingCode(companyId: string, phoneNumber: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });
    if (!config) throw new NotFoundException('Configuração WhatsApp não encontrada');

    const h = this.evoHeaders();
    const name = config.instanceName;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    this.logger.warn(`[PAIRING] Gerando código para ${name} | phone: ${cleanPhone}`);

    // 1) Deletar instância existente
    try {
      await axios.delete(`${this.evolutionUrl}/instance/delete/${name}`, { headers: h, timeout: 10000 });
    } catch { /* ok */ }

    await new Promise((r) => setTimeout(r, 2000));

    // 2) Criar instância sem qrcode
    try {
      const webhookUrl = this.apiBaseUrl?.startsWith('http')
        ? `${this.apiBaseUrl}/whatsapp/webhook`
        : null;

      const createPayload: Record<string, unknown> = {
        instanceName: name,
        // token omitido — Evolution API gera automaticamente (evita conflito "token já existe")
        qrcode: false,
      };
      if (webhookUrl) {
        createPayload.webhook = webhookUrl;
        createPayload.webhook_by_events = false;
        createPayload.events = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
      }

      await axios.post(
        `${this.evolutionUrl}/instance/create`,
        createPayload,
        { headers: h, timeout: 30000 },
      );
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? `status=${e.response?.status} body=${JSON.stringify(e.response?.data).slice(0, 300)}`
        : String(e);
      this.logger.error(`[PAIRING] CREATE falhou: ${msg}`);
      return { code: null, error: `Falha ao criar instância: ${msg}` };
    }

    // 3) GET /instance/connect?number={phone} — na v1.x é assim que se solicita pairing code
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await axios.get(`${this.evolutionUrl}/instance/connect/${name}`, {
        headers: h,
        params: { number: cleanPhone },
        timeout: 15000,
      });
      this.logger.warn(`[PAIRING] connect?number response: ${JSON.stringify(res.data).slice(0, 400)}`);

      // v1.x retorna o pairing code diretamente no connect response
      const code: string =
        res.data?.code ??
        res.data?.pairingCode ??
        res.data?.data?.code ??
        res.data?.base64 ??   // não é QR, seria o código
        null;

      if (code && !code.startsWith('data:image') && code.length < 20) {
        // base64 de QR tem > 1000 chars; pairing code tem 8 chars
        this.logger.warn(`[PAIRING] ✅ Código obtido via connect: ${code}`);
        return { code };
      }

      // Algumas versões retornam o código em campo separado
      if (res.data && typeof res.data === 'object') {
        for (const val of Object.values(res.data as Record<string, unknown>)) {
          if (typeof val === 'string' && val.length >= 6 && val.length <= 12 && /^[A-Z0-9-]+$/.test(val)) {
            this.logger.warn(`[PAIRING] ✅ Código encontrado: ${val}`);
            return { code: val };
          }
        }
      }

      this.logger.warn(`[PAIRING] connect retornou mas sem código reconhecível: ${JSON.stringify(res.data).slice(0, 300)}`);
      return { code: null, error: 'Pairing code não encontrado na resposta. Verifique logs da Evolution API.' };
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? `status=${e.response?.status} body=${JSON.stringify(e.response?.data).slice(0, 300)}`
        : String(e);
      this.logger.error(`[PAIRING] connect?number falhou: ${msg}`);
      return { code: null, error: `Falha ao solicitar pairing code: ${msg}` };
    }
  }

}
