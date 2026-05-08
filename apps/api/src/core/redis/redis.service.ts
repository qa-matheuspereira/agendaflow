import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password'),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });

    this.on('error', (err) => this.logger.error('Redis error:', err));
    this.on('connect', () => this.logger.log('Redis conectado'));
    this.on('reconnecting', () => this.logger.warn('Redis reconectando...'));
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.quit();
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.set(key, value, 'EX', ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.set(key, serialized);
    }
  }

  async acquireLock(key: string, ttlMs: number = 10000): Promise<boolean> {
    const result = await this.set(`lock:${key}`, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(`lock:${key}`);
  }
}
