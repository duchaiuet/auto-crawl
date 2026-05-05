import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QUEUE_NAMES } from '../queues/constants/queue.constants';
import { CrawlController } from './crawl.controller';
import { CrawlService } from './crawl.service';
import { MockDouyinApi } from './mocks/mock-douyin.api';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CRAWL },
      { name: QUEUE_NAMES.PROCESS },
    ),
  ],
  controllers: [CrawlController],
  providers: [CrawlService, MockDouyinApi],
  exports: [CrawlService],
})
export class CrawlModule {}
