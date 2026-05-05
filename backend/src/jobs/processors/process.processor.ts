import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import { CaptionsService } from '../../captions/captions.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { MetricsService } from '../../common/monitoring/metrics.service';
import { JobsService } from '../jobs.service';
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_RETRY_ATTEMPTS,
  JOB_NAMES,
  PROCESS_QUEUE,
} from '../../queues/constants/queue.constants';
import { ProcessingService } from '../../processing/processing.service';
import { PublishService } from '../../publish/publish.service';

@Injectable()
@Processor(PROCESS_QUEUE, { concurrency: 4 })
export class ProcessProcessor extends WorkerHost {
  private readonly retries: number;
  private readonly backoffMs: number;

  constructor(
    private readonly processingService: ProcessingService,
    private readonly captionsService: CaptionsService,
    private readonly publishService: PublishService,
    private readonly jobsService: JobsService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.retries = this.configService.get<number>('MAX_JOB_ATTEMPTS', DEFAULT_RETRY_ATTEMPTS);
    this.backoffMs = this.configService.get<number>('JOB_RETRY_BACKOFF_MS', DEFAULT_BACKOFF_MS);
  }

  async process(job: Job<{ videoId: string }>): Promise<{ captionCount: number; publishJobs: number }> {
    if (job.name !== JOB_NAMES.PROCESS_VIDEO) {
      this.logger.warn(`Unsupported process job: ${job.name}`, ProcessProcessor.name);
      return { captionCount: 0, publishJobs: 0 };
    }

    const queueJobId = String(job.id ?? '');
    const dbJob = await this.jobsService.createJob({
      queueJobId,
      jobType: 'PROCESS',
      payload: job.data as unknown as Record<string, unknown>,
      videoId: job.data.videoId,
      maxAttempts: this.retries,
    });
    await this.jobsService.markRunning(dbJob.id, job.attemptsMade + 1);

    try {
      await this.processingService.downloadAndProcess({
        videoId: job.data.videoId,
      });
      const captions = await this.captionsService.generateAndStoreVariants({
        videoId: job.data.videoId,
      });
      const publishJobs = await this.publishService.enqueuePublishVariants({
        videoId: job.data.videoId,
        attempts: this.retries,
        backoffMs: this.backoffMs,
      });

      await this.jobsService.markSuccess(dbJob.id, {
        videoId: job.data.videoId,
        captionIds: captions.map((c) => c.id),
        publishJobs,
      });
      this.metrics.incrementCounter('job.process.success');
      this.metrics.setGauge('job.process.generated_caption_count', captions.length);

      return { captionCount: captions.length, publishJobs };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const shouldRetry = job.attemptsMade + 1 < (job.opts.attempts ?? this.retries);
      await this.jobsService.markFailure(dbJob.id, errorMessage, shouldRetry);
      this.metrics.incrementCounter('job.process.failed');
      throw error;
    }
  }
}
