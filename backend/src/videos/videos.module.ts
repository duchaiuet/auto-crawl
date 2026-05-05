import { Module } from '@nestjs/common';

import { CrawlModule } from '../crawl/crawl.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [CrawlModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
