import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { AppLogger } from '@/core/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);

  app.useLogger(logger);

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: config.get<string>('frontendUrl', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'apikey'],
  });

  // API versioning
  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Socket.io com Redis Adapter (para escalar horizontalmente)
  const redisHost = config.get<string>('redis.host', 'localhost');
  const redisPort = config.get<number>('redis.port', 6379);
  const redisPassword = config.get<string>('redis.password');

  const pubClient = new Redis({ host: redisHost, port: redisPort, password: redisPassword });
  const subClient = pubClient.duplicate();

  const ioAdapter = new IoAdapter(app);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ioAdapter as any).createIOServer = (_port: number, options?: Record<string, unknown>) => {
  const server = app.getHttpServer();
  const { Server } = require('socket.io');

  const io = new Server(server, {
    ...options,
    cors: {
      origin: config.get<string>('frontendUrl', 'http://localhost:3000'),
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));
  return io;
};

  app.useWebSocketAdapter(ioAdapter);

  // Swagger (apenas em dev)
  if (config.get<string>('nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AgendaFlow API')
      .setDescription('API do SaaS de Agendamento e Fila Inteligente')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Autenticação e sessões')
      .addTag('Payments', 'Pagamentos e Mercado Pago')
      .addTag('WhatsApp Webhook', 'Webhooks Evolution API')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('port', 3001);
  await app.listen(port);

  logger.log(`🚀 AgendaFlow API rodando em http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  logger.log(`📚 Swagger disponível em http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar aplicação:', err);
  process.exit(1);
});
