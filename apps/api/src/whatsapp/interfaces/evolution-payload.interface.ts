// Evolution API webhook payload types (Baileys-based)
// event: "messages.upsert"    → new incoming/outgoing message
// event: "messages.update"    → delivery/read status update
// event: "connection.update"  → instance connection state

export interface EvolutionMessageKey {
  remoteJid: string;   // "5521999@s.whatsapp.net" | "25590713707334@lid" | "GROUP@g.us"
  fromMe: boolean;
  id: string;
  participant?: string; // in groups: actual sender JID
}

export interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: { text: string; contextInfo?: unknown };
  imageMessage?: { caption?: string; url?: string; mimetype?: string };
  audioMessage?: { url?: string; mimetype?: string };
  documentMessage?: { title?: string; url?: string };
  stickerMessage?: { url?: string };
  videoMessage?: { caption?: string; url?: string };
  reactionMessage?: { text?: string; key?: EvolutionMessageKey };
}

export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: EvolutionMessageContent;
  messageType: string; // 'conversation' | 'extendedTextMessage' | 'imageMessage' | ...
  messageTimestamp: number;
  instanceId?: string;
  status?: string;
}

export interface EvolutionAckData {
  key: EvolutionMessageKey;
  update: { status: string }; // 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ'
}

export interface EvolutionConnectionData {
  instance: string;
  state: string; // 'open' | 'close' | 'connecting'
  statusReason?: number;
}

export interface EvolutionWebhookPayload {
  event: string;      // 'messages.upsert' | 'messages.update' | 'connection.update' | ...
  instance: string;   // instanceName
  data: EvolutionMessageData | EvolutionAckData[] | EvolutionConnectionData | unknown;
  apikey?: string;
  destination?: string;
  date_time?: string;
  server_url?: string;
}

// Legacy aliases — keep compilation happy if other files import them
export type WppMessageData = EvolutionMessageData;
export type WppAckData = EvolutionAckData;
export type WppWebhookPayload = EvolutionWebhookPayload;
