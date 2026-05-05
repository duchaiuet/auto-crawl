import { Body, Controller, Post } from '@nestjs/common';

import { CrawlService } from './crawl.service';
import { TriggerCrawlDto } from './dto/trigger-crawl.dto';

@Controller()
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post('trigger-crawl')
  async triggerCrawl(
    @Body() dto: TriggerCrawlDto,
  ): Promise<{ queueId: string; source: string; batchSize: number }> {
    const source = dto.source ?? 'douyin-mock';
    return this.crawlService.enqueueCrawlBatch(source, dto);
  }
}
