import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

// Core
import configuration from '@/core/config/configuration';
import { validationSchema } from '@/core/config/validation';
import { PrismaModule } from '@/core/database/prisma.module';
import { RedisModule } from '@/core/redis/redis.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { TenantGuard } from '@/core/guards/tenant.guard';
import { RolesGuard } from '@/core/guards/roles.guard';
import { GlobalExceptionFilter } from '@/core/filters/global-exception.filter';

// Domain modules
import { AuditModule } from '@/audit/audit.module';
import { AuthModule } from '@/auth/auth.module';
import { CompaniesModule } from '@/companies/companies.module';
import { CollaboratorsModule } from '@/collaborators/collaborators.module';
import { ClientsModule } from '@/clients/clients.module';
import { ServicesModule } from '@/services/services.module';
import { BusinessHoursModule } from '@/business-hours/business-hours.module';
import { ScheduleEngineModule } from '@/schedule-engine/schedule-engine.module';
import { AppointmentsModule } from '@/appointments/appointments.module';
import { QueueModule } from '@/queue/queue.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ReportsModule } from '@/reports/reports.module';
import { SettingsModule } from '@/settings/settings.module';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { PaymentsModule } from '@/payments/payments.module';
import { PackagesModule } from '@/packages/packages.module';

@Module({
  imports: [
    // Config — carregado primeiro
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
      cache: true,
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 100),
          },
        ],
      }),
    }),

    // Cron Jobs
    ScheduleModule.forRoot(),

    // Bull Queue (Redis)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
    }),

    // Core providers (Global)
    PrismaModule,
    RedisModule,
    LoggerModule,

    // Global domain (must be loaded before feature modules that inject them)
    AuditModule,

    // Feature modules
    AuthModule,
    CompaniesModule,
    CollaboratorsModule,
    ClientsModule,
    ServicesModule,
    BusinessHoursModule,
    ScheduleEngineModule,
    AppointmentsModule,
    QueueModule,
    NotificationsModule,
    ReportsModule,
    SettingsModule,
    WhatsappModule,
    PaymentsModule,
    PackagesModule,
  ],
  providers: [
    // Guards globais (ordem importa: JWT → Tenant → Roles)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Exception filter global
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
