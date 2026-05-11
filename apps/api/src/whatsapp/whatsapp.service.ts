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
    const tryNumber = async (num: string): Promise<string | null> => {
      const response = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${instanceName}`,
        { number: num, textMessage: { text: message } },
      );
      return response.data?.key?.id ?? null;
    };

    try {
      const msgId = await tryNumber(toNumber);
      this.logger.debug(`Mensagem enviada para ${toNumber} via instância ${instanceName}`);
      return msgId;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const body = error.response?.data;
        const bodyStr = JSON.stringify(body);
        this.logger.warn(`[SEND] sendText falhou para ${toNumber} (${instanceName}) status=${status}: ${bodyStr}`);

        // Se falhou com "exists: false" e o número não é @lid, tenta com @lid direto
        const isExistsError = bodyStr.includes('exists') && bodyStr.includes('false');
        const isAlreadyLid = toNumber.includes('@lid');
        if (isExistsError && !isAlreadyLid) {
          const lidFallback = `${toNumber}@lid`;
          this.logger.warn(`[SEND] Tentando fallback @lid: ${lidFallback}`);
          try {
            const msgId = await tryNumber(lidFallback);
            this.logger.warn(`[SEND] ✅ Enviado via @lid fallback: ${lidFallback}`);
            return msgId;
          } catch (e2) {
            if (isAxiosError(e2)) {
              this.logger.warn(`[SEND] @lid fallback também falhou: ${e2.response?.status}: ${JSON.stringify(e2.response?.data)}`);
            }
          }
        }
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

    this.logger.warn(`[LID] Tentando resolver ${lidJid} para ${instanceName}`);

    // Estratégia 1: POST /chat/whatsappNumbers — chama onWhatsApp() do Baileys
    // Resolve @lid para o JID real via query ao servidor WhatsApp
    try {
      const resp = await this.http.post<Array<{ exists?: boolean; jid?: string; number?: string }>>(
        `/chat/whatsappNumbers/${instanceName}`,
        { numbers: [lidJid] },
      );
      const entries = Array.isArray(resp.data) ? resp.data : [];
      this.logger.warn(`[LID] whatsappNumbers response: ${JSON.stringify(entries)}`);
      for (const entry of entries) {
        const jid: string = entry.jid ?? '';
        const phone = jid.includes('@') ? jid.split('@')[0] : '';
        if (phone && /^\d{8,15}$/.test(phone)) {
          this.lidCache.set(cacheKey, phone);
          this.logger.warn(`[LID] ✅ Resolvido via whatsappNumbers: ${lidJid} → ${phone}`);
          return phone;
        }
      }
    } catch (err) {
      const msg = isAxiosError(err) ? `${err.response?.status}: ${JSON.stringify(err.response?.data)}` : String(err);
      this.logger.warn(`[LID] whatsappNumbers falhou: ${msg}`);
    }

    // Estratégia 2: GET /contact/fetchProfile com o @lid inteiro
    try {
      const resp = await this.http.get<{ wuid?: string; number?: string }>(
        `/contact/fetchProfile/${instanceName}`,
        { params: { number: lidJid } },
      );
      this.logger.warn(`[LID] fetchProfile response: ${JSON.stringify(resp.data)}`);
      const wuid: string = resp.data?.wuid ?? '';
      const phone = wuid.includes('@') ? wuid.split('@')[0] : (resp.data?.number ?? '');
      if (phone && /^\d{8,15}$/.test(phone)) {
        this.lidCache.set(cacheKey, phone);
        this.logger.warn(`[LID] ✅ Resolvido via fetchProfile: ${lidJid} → ${phone}`);
        return phone;
      }
    } catch (err) {
      const msg = isAxiosError(err) ? `${err.response?.status}` : String(err);
      this.logger.warn(`[LID] fetchProfile falhou: ${msg}`);
    }

    // Estratégia 3: POST /contact/findContacts — busca nos contatos armazenados
    try {
      const resp = await this.http.post<Array<{ wuid?: string; number?: string; id?: string }>>(
        `/contact/findContacts/${instanceName}`,
        { where: { id: lidJid } },
      );
      const contacts = Array.isArray(resp.data) ? resp.data : [];
      this.logger.warn(`[LID] findContacts response: ${JSON.stringify(contacts)}`);
      for (const c of contacts) {
        const wuid: string = c.wuid ?? '';
        const phone = wuid.includes('@') ? wuid.split('@')[0] : (c.number ?? '');
        if (phone && /^\d{8,15}$/.test(phone)) {
          this.lidCache.set(cacheKey, phone);
          this.logger.warn(`[LID] ✅ Resolvido via findContacts: ${lidJid} → ${phone}`);
          return phone;
        }
      }
    } catch { /* ignora */ }

    this.logger.warn(`[LID] ❌ Não foi possível resolver ${lidJid} — sendText usará @lid direto`);
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
