import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import { AppLoggerService } from '../../common/logging/app-logger.service';
import { MetricsService } from '../../common/monitoring/metrics.service';
import { JobsService } from '../jobs.service';
import { PublishService } from '../../publish/publish.service';
import { JOB_NAMES, QUEUE_NAMES } from '../../queues/constants/queue.constants';
import { PublishJobDto } from '../../publish/dto/publish-job.dto';

@Injectable()
@Processor(QUEUE_NAMES.PUBLISH, { concurrency: 4 })
export class PublishProcessor extends WorkerHost {
  private readonly maxAttempts: number;

  constructor(
    private readonly publishService: PublishService,
    private readonly jobsService: JobsService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.maxAttempts = this.configService.get<number>('MAX_JOB_ATTEMPTS', 3);
  }

  async process(job: Job<PublishJobDto>): Promise<void> {
    if (job.name !== JOB_NAMES.PUBLISH_VARIANT) {
      return;
    }

    const persistedJob = await this.jobsService.createJob({
      queueJobId: String(job.id ?? ''),
      jobType: 'PUBLISH',
      payload: job.data as unknown as Record<string, unknown>,
      videoId: job.data.videoId,
      maxAttempts: this.maxAttempts,
    });
    await this.jobsService.markRunning(persistedJob.id, job.attemptsMade + 1);
    this.metrics.incrementCounter('jobs.publish.started');

    try {
      await this.publishService.mockPublish(job.data);
      await this.jobsService.markSuccess(persistedJob.id, {
        videoId: job.data.videoId,
        captionId: job.data.captionId,
      });
      this.metrics.incrementCounter('jobs.publish.success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish error';
      await this.jobsService.markRetryOrFail(
        persistedJob.id,
        message,
        job.attemptsMade + 1,
        this.maxAttempts,
      );
      this.metrics.incrementCounter('jobs.publish.failed');
      this.logger.error(
        {
          message: 'Publish worker failed',
          videoId: job.data.videoId,
          captionId: job.data.captionId,
          attemptsMade: job.attemptsMade + 1,
        },
        error instanceof Error ? error.stack : undefined,
        PublishProcessor.name,
      );
      throw error;
    }
  }
}
