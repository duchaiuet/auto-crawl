import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { toBoolean } from './common/utils/boolean.util';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API ready at http://localhost:${port}`);
  logger.log(`Monitoring at http://localhost:${port}/monitoring/summary`);
  logger.log(`Scheduler enabled: ${toBoolean(process.env.SCHEDULER_ENABLED, true)}`);
}

void bootstrap();
