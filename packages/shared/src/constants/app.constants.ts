export const APP_NAME = 'AgendaFlow';
export const APP_VERSION = '1.0.0';

// JWT
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// Conversa WhatsApp
export const CONVERSATION_TTL_MINUTES = 30;
export const MAX_MENU_ITEMS_PER_MESSAGE = 9;

// Fila
export const QUEUE_CALLED_TIMEOUT_MINUTES = 10;
export const MAX_QUEUE_POSITION_DISPLAY = 50;

// Notificações
export const REMINDER_HOURS_BEFORE_DEFAULT = 2;
export const REMINDER_DAY_BEFORE_DEFAULT = true;

// Paginação
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Bloqueio automático
export const DEFAULT_AUTO_BLOCK_ABSENCES = 3;
export const DEFAULT_AUTO_BLOCK_WINDOW_DAYS = 30;

// Retorno automático
export const DEFAULT_AUTO_RETURN_DAYS = 30;

// Bull Queue names
export const QUEUE_WHATSAPP_NOTIFICATIONS = 'whatsapp-notifications';
export const QUEUE_PAYMENT_PROCESSING = 'payment-processing';
export const QUEUE_SCHEDULE_REMINDERS = 'schedule-reminders';
export const QUEUE_AUTO_RULES = 'auto-rules';

// Socket.io namespaces
export const SOCKET_NAMESPACE_QUEUE = '/queue';

// Mercado Pago
export const MP_PAYMENT_LINK_EXPIRY_HOURS = 24;
