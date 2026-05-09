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

    // Verificar se Evolution API está configurada
    if (!this.evolutionUrl || this.evolutionUrl.includes('localhost:8080')) {
      const isReachable = await axios.get(`${this.evolutionUrl}/`, { timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!isReachable) {
        return {
          qrcode: null,
          error: 'Evolution API não está disponível. Configure EVOLUTION_API_URL com a URL correta e certifique-se que o serviço está rodando.',
        };
      }
    }

    try {
      // Tenta buscar QR de instância existente
      const res = await axios.get(
        `${this.evolutionUrl}/instance/qrcode/base64/${config.instanceName}`,
        { headers: this.evoHeaders(), timeout: 10000 },
      );
      const base64 = res.data?.qrcode?.base64 ?? res.data?.base64 ?? null;
      return { qrcode: base64 };
    } catch (err: unknown) {
      // Instância não existe — criar
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        try {
          const createRes = await axios.post(
            `${this.evolutionUrl}/instance/create`,
            {
              instanceName: config.instanceName,
              token: this.evolutionKey,
              qrcode: true,
            },
            { headers: this.evoHeaders(), timeout: 10000 },
          );
          const base64 = createRes.data?.qrcode?.base64 ?? null;
          return { qrcode: base64 };
        } catch {
          return { qrcode: null, error: 'Falha ao criar instância na Evolution API' };
        }
      }

      // Connection refused / timeout
      if (axios.isAxiosError(err) && !err.response) {
        return {
          qrcode: null,
          error: 'Não foi possível conectar à Evolution API. Verifique se o serviço está rodando.',
        };
      }

      return { qrcode: null, error: 'Falha ao gerar QR Code' };
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
