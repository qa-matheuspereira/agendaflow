export default () => ({
  apiBaseUrl: process.env.API_BASE_URL ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },

  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL ?? 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY ?? '',
  },

  mercadopago: {
    platformAccessToken: process.env.MP_PLATFORM_ACCESS_TOKEN,
    platformPublicKey: process.env.MP_PLATFORM_PUBLIC_KEY,
    webhookSecret: process.env.MP_WEBHOOK_SECRET,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL ?? 'debug',
    format: process.env.LOG_FORMAT ?? 'json',
  },

  n8n: {
    webhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL ?? '',
    apiKey: process.env.N8N_API_KEY ?? '',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? 'super@agendaflow.com.br',
    password: process.env.SUPER_ADMIN_PASSWORD ?? '',
  },
});
