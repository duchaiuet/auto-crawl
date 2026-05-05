import { Injectable } from '@nestjs/common';

import { CrawledVideoDto } from '../dto/crawled-video.dto';

@Injectable()
export class MockDouyinApi {
  async fetchVideos(limit: number): Promise<CrawledVideoDto[]> {
    const now = Date.now();
    return Array.from({ length: limit }).map((_, idx) => {
      const likeBase = 30_000 + (idx + 1) * 4000;
      const commentBase = 3000 + (idx + 1) * 500;
      return {
        sourceId: `douyin-${now}-${idx + 1}`,
        url: `https://mock.douyin.local/video/${now}-${idx + 1}`,
        likeCount: likeBase,
        commentCount: commentBase,
        description: `Video #${idx + 1}: xu huong dang hot, giu chan nguoi xem.`,
      };
    });
  }
}
