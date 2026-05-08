import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance, isAxiosError } from 'axios';
import { PrismaService } from '@/core/database/prisma.service';

interface EvolutionSendResponse {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  status?: string;
}

interface EvolutionConnectionState {
  instance?: { instanceName?: string; state?: string };
  state?: string;
}

interface EvolutionContactProfile {
  wuid?: string;    // "5511999999999@s.whatsapp.net"
  number?: string;  // "5511999999999"
  name?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  // lid → resolved phone number; scoped per instanceName
  private readonly lidCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('evolution.apiKey') ?? '';
    this.http = axios.create({
      baseURL: this.configService.get<string>('evolution.apiUrl'),
      headers: { 'Content-Type': 'application/json', apikey: this.apiKey },
      timeout: 15000,
    });
  }

  async sendText(instanceName: string, toNumber: string, message: string): Promise<string | null> {
    try {
      const response = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${instanceName}`,
        { number: toNumber, textMessage: { text: message } },
      );
      this.logger.debug(`Mensagem enviada para ${toNumber} via instância ${instanceName}`);
      return response.data?.key?.id ?? null;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const body = error.response?.data;
        this.logger.warn(`sendText falhou para ${toNumber} (${instanceName}) status=${status}: ${JSON.stringify(body)}`);
      } else {
        this.logger.error(`sendText erro inesperado para ${toNumber} (${instanceName}):`, error);
      }
      return null;
    }
  }

  async sendImage(
    instanceName: string,
    toNumber: string,
    imageUrl: string,
    caption?: string,
  ): Promise<void> {
    try {
      await this.http.post(`/message/sendMedia/${instanceName}`, {
        number: toNumber,
        mediatype: 'image',
        media: imageUrl,
        caption: caption ?? '',
      });
    } catch (error) {
      if (isAxiosError(error)) {
        this.logger.warn(`sendImage falhou para ${toNumber}: ${error.response?.status}`);
      }
    }
  }

  /**
   * Resolve @lid do WhatsApp para número de telefone real via Evolution API.
   * @lid é um ID opaco — o telefone NÃO está no payload do webhook.
   * Tenta múltiplos endpoints pois a versão da Evolution API pode variar.
   */
  async resolvePhoneFromLid(instanceName: string, lidJid: string): Promise<string | null> {
    const cacheKey = `${instanceName}:${lidJid}`;
    if (this.lidCache.has(cacheKey)) return this.lidCache.get(cacheKey)!;

    const endpoints = [
      { method: 'get' as const, path: `/contact/fetchProfile/${instanceName}`, params: { number: lidJid } },
      { method: 'get' as const, path: `/chat/fetchProfile/${instanceName}`, params: { number: lidJid } },
    ];

    for (const ep of endpoints) {
      try {
        const resp = await this.http[ep.method]<EvolutionContactProfile>(ep.path, { params: ep.params });
        const wuid: string = resp.data?.wuid ?? '';
        const phone = wuid.includes('@') ? wuid.split('@')[0] : (resp.data?.number ?? '');
        if (phone && /^\d{10,15}$/.test(phone)) {
          this.lidCache.set(cacheKey, phone);
          this.logger.log(`@lid ${lidJid} resolvido → ${phone} (via ${ep.path})`);
          return phone;
        }
      } catch (err) {
        if (isAxiosError(err)) {
          this.logger.debug(`resolvePhoneFromLid ${ep.path} falhou: ${err.response?.status}`);
        }
      }
    }

    // Tenta buscar nos contatos da instância filtrando pelo @lid
    try {
      const resp = await this.http.post<EvolutionContactProfile[]>(
        `/contact/findContacts/${instanceName}`,
        { where: { id: lidJid } },
      );
      const contacts = Array.isArray(resp.data) ? resp.data : [];
      for (const c of contacts) {
        const wuid: string = c.wuid ?? '';
        const phone = wuid.includes('@') ? wuid.split('@')[0] : (c.number ?? '');
        if (phone && /^\d{10,15}$/.test(phone)) {
          this.lidCache.set(cacheKey, phone);
          this.logger.log(`@lid ${lidJid} resolvido via findContacts → ${phone}`);
          return phone;
        }
      }
    } catch { /* ignora */ }

    this.logger.debug(`@lid ${lidJid} não resolvido — usando fallback`);
    return null;
  }

  async getInstanceStatus(instanceName: string): Promise<{ state: string; connected: boolean }> {
    try {
      const response = await this.http.get<EvolutionConnectionState>(
        `/instance/connectionState/${instanceName}`,
      );
      const state = response.data?.instance?.state ?? response.data?.state ?? 'close';
      const connected = state === 'open';
      return { state: connected ? 'CONNECTED' : 'DISCONNECTED', connected };
    } catch {
      return { state: 'DISCONNECTED', connected: false };
    }
  }

  async processStatusUpdate(payload: unknown): Promise<void> {
    const evt = payload as { instance?: string; data?: { state?: string } };
    const instanceName = evt.instance;
    if (!instanceName) return;

    const state = evt.data?.state ?? '';
    this.logger.debug(`Connection update para ${instanceName}: ${state}`);

    const config = await this.prisma.whatsappConfig.findUnique({ where: { instanceName } });
    if (!config) return;

    const connected = state === 'open';
    await this.prisma.whatsappConfig.update({
      where: { instanceName },
      data: { isConnected: connected },
    });
  }
}
