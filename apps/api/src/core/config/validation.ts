import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  API_BASE_URL: Joi.string().optional().default(''),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  EVOLUTION_API_URL: Joi.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: Joi.string().optional(),

  MP_PLATFORM_ACCESS_TOKEN: Joi.string().optional(),
  MP_PLATFORM_PUBLIC_KEY: Joi.string().optional(),
  MP_WEBHOOK_SECRET: Joi.string().optional(),

  GROQ_API_KEY: Joi.string().optional(),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('debug'),

  SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
});
