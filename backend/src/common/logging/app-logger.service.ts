import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    // eslint-disable-next-line no-console
    console.log(this.format('INFO', message, context));
  }

  error(message: unknown, trace?: string, context?: string): void {
    // eslint-disable-next-line no-console
    console.error(this.format('ERROR', message, context), trace ?? '');
  }

  warn(message: unknown, context?: string): void {
    // eslint-disable-next-line no-console
    console.warn(this.format('WARN', message, context));
  }

  debug(message: unknown, context?: string): void {
    // eslint-disable-next-line no-console
    console.debug(this.format('DEBUG', message, context));
  }

  verbose(message: unknown, context?: string): void {
    // eslint-disable-next-line no-console
    console.debug(this.format('VERBOSE', message, context));
  }

  private format(level: string, message: unknown, context?: string): string {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const contextPart = context ? ` [${context}]` : '';
    return `${new Date().toISOString()} ${level}${contextPart} ${payload}`;
  }
}
