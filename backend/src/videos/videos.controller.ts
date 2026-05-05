import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { TriggerCrawlDto } from '../crawl/dto/trigger-crawl.dto';
import { CrawlService } from '../crawl/crawl.service';
import { ListVideosQueryDto } from './dto/list-videos.query';
import { VideosService } from './videos.service';

@Controller()
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly crawlService: CrawlService,
  ) {}

  @Get('videos')
  getVideos(@Query() query: ListVideosQueryDto): Promise<unknown[]> {
    return this.videosService.listVideos(query);
  }

  @Get('processed')
  getProcessed(): Promise<unknown[]> {
    return this.videosService.listProcessed();
  }

  @Post('trigger-crawl')
  triggerCrawl(
    @Body() dto: TriggerCrawlDto,
  ): Promise<{ queueId: string; source: string; batchSize: number }> {
    return this.crawlService.enqueueCrawlBatch(dto.source ?? 'api', dto);
  }
}
