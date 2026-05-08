import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger = createLogger({
      level: process.env.LOG_LEVEL ?? 'debug',
      format: isProduction
        ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
        : format.combine(
            format.timestamp({ format: 'HH:mm:ss' }),
            format.errors({ stack: true }),
            format.colorize(),
            format.printf(({ level, message, timestamp, context, ...meta }) => {
              const ctx = context ? `[${String(context)}]` : '';
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${String(timestamp)} ${level} ${ctx} ${String(message)}${metaStr}`;
            }),
          ),
      transports: [new transports.Console()],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
