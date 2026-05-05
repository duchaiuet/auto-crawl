import { Module } from '@nestjs/common';

import { CrawlModule } from '../crawl/crawl.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [CrawlModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
