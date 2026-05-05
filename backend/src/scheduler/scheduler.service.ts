import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { toBoolean } from '../common/utils/boolean.util';
import { CrawlService } from '../crawl/crawl.service';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly crawlService: CrawlService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async triggerScheduledCrawl(): Promise<void> {
    const enabled = toBoolean(this.configService.get('SCHEDULER_ENABLED', 'true'), true);
    if (!enabled) {
      return;
    }

    await this.crawlService.enqueueCrawlBatch('scheduler');
  }
}
