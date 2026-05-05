import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType, VideoStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { CaptionsService } from '../captions/captions.service';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { MetricsService } from '../common/monitoring/metrics.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_RETRY_ATTEMPTS,
  JOB_NAMES,
  PUBLISH_QUEUE,
} from '../queues/constants/queue.constants';
import { PublishJobDto } from './dto/publish-job.dto';

@Injectable()
export class PublishService {
  private readonly retryAttempts: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly captionsService: CaptionsService,
    private readonly jobsService: JobsService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue,
  ) {
    this.retryAttempts = this.configService.get<number>('MAX_JOB_ATTEMPTS', DEFAULT_RETRY_ATTEMPTS);
    this.retryBackoffMs = this.configService.get<number>('JOB_RETRY_BACKOFF_MS', DEFAULT_BACKOFF_MS);
  }

  async enqueuePublishVariants(input: {
    videoId: string;
    attempts?: number;
    backoffMs?: number;
  }): Promise<number> {
    const captions = await this.prisma.caption.findMany({
      where: { videoId: input.videoId },
      orderBy: { variant: 'asc' },
      take: 3,
    });

    const attempts = input.attempts ?? this.retryAttempts;
    const backoffMs = input.backoffMs ?? this.retryBackoffMs;

    for (const caption of captions) {
      const processedVideo = await this.prisma.processedVideo.findFirst({
        where: { videoId: input.videoId },
        orderBy: { createdAt: 'desc' },
      });
      if (!processedVideo) {
        throw new Error(`No processed video for ${input.videoId}`);
      }

      const queueJob = await this.publishQueue.add(
        JOB_NAMES.PUBLISH_VARIANT,
        {
          videoId: input.videoId,
          processedVideoId: processedVideo.id,
          captionId: caption.id,
        },
        {
          attempts,
          backoff: {
            type: 'exponential',
            delay: backoffMs,
          },
        },
      );
      await this.jobsService.createJob({
        queueJobId: String(queueJob.id ?? ''),
        jobType: JobType.PUBLISH,
        status: 'PENDING',
        payload: {
          videoId: input.videoId,
          processedVideoId: processedVideo.id,
          captionId: caption.id,
        },
        videoId: input.videoId,
        maxAttempts: attempts,
      });
    }

    this.metrics.incrementCounter('queue.publish.enqueued', captions.length);
    return captions.length;
  }

  async mockPublish(payload: PublishJobDto): Promise<{ status: 'posted'; captionId: string }> {
    const [video, caption, processedVideo] = await Promise.all([
      this.prisma.video.findUnique({ where: { id: payload.videoId } }),
      this.prisma.caption.findUnique({ where: { id: payload.captionId } }),
      this.prisma.processedVideo.findUnique({ where: { id: payload.processedVideoId } }),
    ]);
    if (!video || !caption || !processedVideo) {
      throw new Error('Publish payload references missing entities');
    }

    this.logger.log(
      {
        event: 'publish.mock',
        videoId: video.id,
        processedVideoPath: processedVideo.processedPath,
        caption: caption.content,
      },
      PublishService.name,
    );

    await this.prisma.caption.update({
      where: { id: caption.id },
      data: {
        posts: { increment: 1 },
        impressions: { increment: 1000 + caption.variant * 100 },
        clicks: { increment: 80 + caption.variant * 10 },
        engagementScore: caption.engagementScore + 0.25 * caption.variant,
      },
    });

    await this.prisma.video.update({
      where: { id: video.id },
      data: { status: VideoStatus.PUBLISHED },
    });

    await this.captionsService.pickBestVariant(video.id);
    this.metrics.incrementCounter('publish.completed');

    return { status: 'posted', captionId: caption.id };
  }
}
