import { Injectable } from '@nestjs/common';
import { JobStatus, JobType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type CreateJobInput = {
  queueJobId?: string;
  jobType: JobType | `${JobType}`;
  status?: JobStatus | `${JobStatus}`;
  payload?: Prisma.InputJsonValue;
  videoId?: string;
  attempt?: number;
  maxAttempts?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string | null;
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(input: CreateJobInput) {
    return this.prisma.job.create({
      data: {
        queueJobId: input.queueJobId ?? null,
        jobType: input.jobType as JobType,
        status: (input.status ?? JobStatus.PENDING) as JobStatus,
        payload: input.payload,
        videoId: input.videoId,
        attempt: input.attempt ?? 0,
        maxAttempts: input.maxAttempts ?? 3,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  async markRunning(jobId: string, attempt: number): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        attempt,
        startedAt: new Date(),
      },
    });
  }

  async markSuccess(jobId: string, payload?: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        payload,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markFailure(jobId: string, errorMessage: string, shouldRetry: boolean): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? JobStatus.RETRYING : JobStatus.FAILED,
        errorMessage,
        completedAt: shouldRetry ? null : new Date(),
      },
    });
  }

  async markRetryOrFail(
    jobId: string,
    errorMessage: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    const shouldRetry = attempt < maxAttempts;
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        attempt,
        maxAttempts,
        status: shouldRetry ? JobStatus.RETRYING : JobStatus.FAILED,
        errorMessage,
        completedAt: shouldRetry ? null : new Date(),
      },
    });
  }
}
