import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CaptionsModule } from './captions/captions.module';
import { CommonModule } from './common/common.module';
import { validateEnvironment } from './config/env.validation';
import { CrawlModule } from './crawl/crawl.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcessingModule } from './processing/processing.module';
import { PublishModule } from './publish/publish.module';
import { QueueModule } from './queues/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    QueueModule,
    CrawlModule,
    ProcessingModule,
    CaptionsModule,
    PublishModule,
    JobsModule,
    SchedulerModule,
    VideosModule,
  ],
})
export class AppModule {}
