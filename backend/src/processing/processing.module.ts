import { Module } from '@nestjs/common';

import { FfmpegService } from './ffmpeg/ffmpeg.service';
import { ProcessingService } from './processing.service';

@Module({
  providers: [FfmpegService, ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
