import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, VideoStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { AppLoggerService } from '../common/logging/app-logger.service';
import { MetricsService } from '../common/monitoring/metrics.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_RETRY_ATTEMPTS,
  JOB_NAMES,
  QUEUE_NAMES,
} from '../queues/constants/queue.constants';
import { CrawledVideoDto } from './dto/crawled-video.dto';
import { TriggerCrawlDto } from './dto/trigger-crawl.dto';
import { MockDouyinApi } from './mocks/mock-douyin.api';

type PersistedVideo = {
  id: string;
  sourceUrl: string;
  sourceVideoId: string | null;
  likeCount: number;
  commentCount: number;
  description: string;
  score: number;
  selectedTop20: boolean;
};

@Injectable()
export class CrawlService {
  private readonly minLikes: number;
  private readonly minComments: number;
  private readonly topPercent: number;
  private readonly retryAttempts: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
    private readonly mockApi: MockDouyinApi,
    private readonly jobsService: JobsService,
    @InjectQueue(QUEUE_NAMES.CRAWL) private readonly crawlQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PROCESS) private readonly processQueue: Queue,
  ) {
    this.minLikes = this.configService.get<number>('CRAWL_MIN_LIKES', 50000);
    this.minComments = this.configService.get<number>('CRAWL_MIN_COMMENTS', 5000);
    this.topPercent = this.configService.get<number>('TOP_PERCENT', 0.2);
    this.retryAttempts = this.configService.get<number>(
      'MAX_JOB_ATTEMPTS',
      DEFAULT_RETRY_ATTEMPTS,
    );
    this.retryBackoffMs = this.configService.get<number>(
      'JOB_RETRY_BACKOFF_MS',
      DEFAULT_BACKOFF_MS,
    );
  }

  async enqueueCrawlBatch(source: string, dto?: TriggerCrawlDto): Promise<{
    queueId: string;
    source: string;
    batchSize: number;
  }> {
    const batchSize = dto?.batchSize ?? this.configService.get<number>('CRAWL_BATCH_SIZE', 30);
    const queueJob = await this.crawlQueue.add(
      JOB_NAMES.CRAWL_BATCH,
      {
        source,
        batchId: `${source}-${Date.now()}`,
        limit: batchSize,
      },
      {
        attempts: this.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: this.retryBackoffMs,
        },
      },
    );

    return {
      queueId: String(queueJob.id ?? 'unknown'),
      source,
      batchSize,
    };
  }

  async crawlAndQueue(input: {
    batchId: string;
    source: string;
    limit: number;
  }): Promise<{ crawled: number; filtered: number; selectedTop20: number }> {
    const result = await this.crawlAndStoreVideos({
      batchId: input.batchId,
      limit: input.limit,
    });
    const selectedTop20 = await this.enqueueTopVideos(result.selected);

    return {
      crawled: result.crawledCount,
      filtered: result.filteredCount,
      selectedTop20,
    };
  }

  async crawlAndStoreVideos(input: {
    batchId: string;
    limit?: number;
  }): Promise<{
    crawledCount: number;
    filteredCount: number;
    selected: PersistedVideo[];
  }> {
    const size = input.limit ?? this.configService.get<number>('CRAWL_BATCH_SIZE', 30);
    const crawled = await this.mockApi.fetchVideos(size);
    const filtered = crawled.filter(
      (item) => item.likeCount > this.minLikes && item.commentCount > this.minComments,
    );
    const scored = filtered
      .map((item) => ({
        ...item,
        score: this.scoreVideo(item),
      }))
      .sort((a, b) => b.score - a.score);

    const topCount = Math.max(1, Math.ceil(scored.length * this.topPercent));
    const selectedUrls = new Set(scored.slice(0, topCount).map((item) => item.url));
    const selectedPersisted: PersistedVideo[] = [];

    for (const item of scored) {
      const createData: Prisma.VideoCreateInput = {
        sourceVideoId: item.sourceId,
        sourceUrl: item.url,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        score: item.score,
        description: item.description,
        status: selectedUrls.has(item.url) ? VideoStatus.QUEUED : VideoStatus.NEW,
        selectedTop20: selectedUrls.has(item.url),
        crawlBatchId: input.batchId,
        metadata: {
          source: 'mock_douyin',
        },
      };

      const saved = await this.prisma.video.upsert({
        where: { sourceUrl: item.url },
        create: createData,
        update: {
          sourceVideoId: item.sourceId,
          likeCount: item.likeCount,
          commentCount: item.commentCount,
          score: item.score,
          description: item.description,
          status: selectedUrls.has(item.url) ? VideoStatus.QUEUED : VideoStatus.NEW,
          selectedTop20: selectedUrls.has(item.url),
          crawlBatchId: input.batchId,
          metadata: {
            source: 'mock_douyin',
          },
        },
      });

      if (saved.selectedTop20) {
        selectedPersisted.push({
          id: saved.id,
          sourceUrl: saved.sourceUrl,
          sourceVideoId: saved.sourceVideoId,
          likeCount: saved.likeCount,
          commentCount: saved.commentCount,
          description: saved.description,
          score: saved.score,
          selectedTop20: saved.selectedTop20,
        });
      }
    }

    this.metrics.incrementCounter('crawl.runs.total');
    this.metrics.setGauge('crawl.batch.crawled', crawled.length);
    this.metrics.setGauge('crawl.batch.filtered', filtered.length);
    this.metrics.setGauge('crawl.batch.selected_top20', selectedPersisted.length);

    this.logger.log(
      {
        event: 'crawl_batch.completed',
        batchId: input.batchId,
        crawled: crawled.length,
        filtered: filtered.length,
        selectedTop20: selectedPersisted.length,
      },
      CrawlService.name,
    );

    return {
      crawledCount: crawled.length,
      filteredCount: filtered.length,
      selected: selectedPersisted,
    };
  }

  async enqueueTopVideos(videos: PersistedVideo[]): Promise<number> {
    for (const video of videos) {
      const queueJob = await this.processQueue.add(
        JOB_NAMES.PROCESS_VIDEO,
        { videoId: video.id },
        {
          attempts: this.retryAttempts,
          backoff: {
            type: 'exponential',
            delay: this.retryBackoffMs,
          },
        },
      );

      await this.jobsService.createJob({
        queueJobId: String(queueJob.id ?? ''),
        jobType: 'PROCESS',
        payload: { videoId: video.id },
        videoId: video.id,
        maxAttempts: this.retryAttempts,
      });
    }

    this.metrics.incrementCounter('queue.process.enqueued', videos.length);
    return videos.length;
  }

  private scoreVideo(video: CrawledVideoDto): number {
    return video.likeCount * 0.7 + video.commentCount * 0.3;
  }
}
