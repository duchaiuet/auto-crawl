import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProcessedVideo, VideoStatus } from '@prisma/client';

import { AppLoggerService } from '../common/logging/app-logger.service';
import { MetricsService } from '../common/monitoring/metrics.service';
import { toBoolean } from '../common/utils/boolean.util';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessVideoJobDto } from './dto/process-video-job.dto';
import { FfmpegService } from './ffmpeg/ffmpeg.service';

@Injectable()
export class ProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ffmpegService: FfmpegService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async downloadAndProcess(job: ProcessVideoJobDto): Promise<ProcessedVideo> {
    const video = await this.prisma.video.findUnique({
      where: { id: job.videoId },
    });
    if (!video) {
      throw new Error(`Video ${job.videoId} not found`);
    }

    await this.prisma.video.update({
      where: { id: video.id },
      data: { status: VideoStatus.PROCESSING },
    });

    const storageDir = this.configService.get<string>('VIDEO_STORAGE_DIR', './storage');
    const sourcePath = `${storageDir}/downloads/${video.id}.mp4`;
    const outputPath = `${storageDir}/processed/${video.id}.mp4`;
    const cropWatermark = toBoolean(this.configService.get('CROP_WATERMARK', 'true'), true);
    const trimDurationSec = this.randomBetween(10, 20);
    const trimStartSec = this.randomBetween(0, 8);
    const subtitlePlaceholder = 'Subtitle placeholder';

    await this.ffmpegService.downloadVideo({
      url: video.sourceUrl,
      destinationPath: sourcePath,
    });
    const ffmpegResult = await this.ffmpegService.processVideo({
      sourcePath,
      outputPath,
      trimStartSec,
      trimDurationSec,
      cropWatermark,
      subtitleText: subtitlePlaceholder,
    });

    const processed = await this.prisma.processedVideo.create({
      data: {
        videoId: video.id,
        originalPath: sourcePath,
        processedPath: outputPath,
        watermarkRemoved: ffmpegResult.watermarkRemoved,
        trimStartSec: ffmpegResult.trimStartSec,
        trimDurationSec: ffmpegResult.trimDurationSec,
        width: 1080,
        height: 1920,
        subtitlePlaceholder: ffmpegResult.subtitlePlaceholder,
        processingMeta: {
          source: 'ffmpeg',
          resizedTo: '9:16',
          cropWatermark: ffmpegResult.watermarkRemoved,
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.PROCESSED,
      },
    });

    this.metrics.incrementCounter('processing.completed');
    this.logger.log(
      {
        event: 'video.processed',
        videoId: video.id,
        processedVideoId: processed.id,
      },
      ProcessingService.name,
    );

    return processed;
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
