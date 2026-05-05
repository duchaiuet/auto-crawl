import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import { AppLoggerService } from '../../common/logging/app-logger.service';
import { MetricsService } from '../../common/monitoring/metrics.service';
import { CrawlService } from '../../crawl/crawl.service';
import { JobsService } from '../jobs.service';
import {
  DEFAULT_RETRY_ATTEMPTS,
  JOB_NAMES,
  QUEUE_NAMES,
} from '../../queues/constants/queue.constants';

@Injectable()
@Processor(QUEUE_NAMES.CRAWL, { concurrency: 2 })
export class CrawlProcessor extends WorkerHost {
  constructor(
    private readonly crawlService: CrawlService,
    private readonly jobsService: JobsService,
    private readonly metrics: MetricsService,
    private readonly logger: AppLoggerService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ batchId: string; source: string; limit: number }>): Promise<{
    crawled: number;
    filtered: number;
    selectedTop20: number;
  }> {
    if (job.name !== JOB_NAMES.CRAWL_BATCH) {
      return {
        crawled: 0,
        filtered: 0,
        selectedTop20: 0,
      };
    }

    const dbJob = await this.jobsService.createJob({
      queueJobId: String(job.id ?? ''),
      jobType: 'CRAWL',
      payload: job.data as unknown as Record<string, unknown>,
      maxAttempts: this.configService.get<number>('MAX_JOB_ATTEMPTS', DEFAULT_RETRY_ATTEMPTS),
    });
    await this.jobsService.markRunning(dbJob.id, job.attemptsMade + 1);

    try {
      const result = await this.crawlService.crawlAndQueue({
        batchId: job.data.batchId,
        source: job.data.source,
        limit: job.data.limit,
      });

      await this.jobsService.markSuccess(dbJob.id, result as unknown as Record<string, unknown>);
      this.metrics.incrementCounter('jobs.crawl.success');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetrying = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
      await this.jobsService.markFailure(dbJob.id, message, isRetrying);
      this.metrics.incrementCounter('jobs.crawl.failed');
      this.logger.error({ jobId: job.id, error: message }, undefined, CrawlProcessor.name);
      throw error;
    }
  }
}
