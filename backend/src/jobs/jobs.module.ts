import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CaptionsModule } from '../captions/captions.module';
import { CrawlModule } from '../crawl/crawl.module';
import { ProcessingModule } from '../processing/processing.module';
import { PublishModule } from '../publish/publish.module';
import { QUEUE_NAMES } from '../queues/constants/queue.constants';
import { JobsService } from './jobs.service';
import { CrawlProcessor } from './processors/crawl.processor';
import { ProcessProcessor } from './processors/process.processor';
import { PublishProcessor } from './processors/publish.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CRAWL },
      { name: QUEUE_NAMES.PROCESS },
      { name: QUEUE_NAMES.PUBLISH },
    ),
    CrawlModule,
    ProcessingModule,
    CaptionsModule,
    PublishModule,
  ],
  providers: [JobsService, CrawlProcessor, ProcessProcessor, PublishProcessor],
  exports: [JobsService],
})
export class JobsModule {}
