import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CRAWL_QUEUE, PROCESS_QUEUE, PUBLISH_QUEUE } from './constants/queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: config.get<number>('MAX_JOB_ATTEMPTS', 3),
          backoff: {
            type: 'exponential',
            delay: config.get<number>('JOB_RETRY_BACKOFF_MS', 2000),
          },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: CRAWL_QUEUE },
      { name: PROCESS_QUEUE },
      { name: PUBLISH_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
