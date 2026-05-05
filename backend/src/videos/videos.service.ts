import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ListVideosQueryDto } from './dto/list-videos.query';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async listVideos(query: ListVideosQueryDto) {
    const where: Prisma.VideoWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.topOnly === 'true') {
      where.selectedTop20 = true;
    }

    return this.prisma.video.findMany({
      where,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async listProcessed(limit = 50) {
    return this.prisma.processedVideo.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { video: true },
    });
  }
}
