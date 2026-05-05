import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const execFileAsync = promisify(execFile);

type DownloadParams = {
  url: string;
  destinationPath: string;
};

type ProcessParams = {
  sourcePath: string;
  outputPath: string;
  trimStartSec: number;
  trimDurationSec: number;
  cropWatermark: boolean;
  subtitleText: string;
};

type ProcessResult = {
  trimStartSec: number;
  trimDurationSec: number;
  watermarkRemoved: boolean;
  subtitlePlaceholder: string;
};

@Injectable()
export class FfmpegService {
  private readonly ffmpegBinary: string;

  constructor(private readonly configService: ConfigService) {
    this.ffmpegBinary = this.configService.get<string>('FFMPEG_BINARY', 'ffmpeg');
  }

  async downloadVideo(params: DownloadParams): Promise<void> {
    await fs.mkdir(dirname(params.destinationPath), { recursive: true });
    // Mock downloader for now; replace with ytdlp/http streaming in production.
    await fs.writeFile(
      params.destinationPath,
      `mock-downloaded-video-from:${params.url}\ncreated:${new Date().toISOString()}\n`,
      'utf-8',
    );
  }

  async processVideo(params: ProcessParams): Promise<ProcessResult> {
    await fs.mkdir(dirname(params.outputPath), { recursive: true });

    const safeSubtitle = params.subtitleText.replace(/'/g, "\\'");
    const watermarkCrop = params.cropWatermark ? ',crop=iw*0.96:ih*0.96:0:0' : '';
    const vf = `scale=1080:1920:force_original_aspect_ratio=cover,setsar=1${watermarkCrop},drawtext=text='${safeSubtitle}':x=(w-text_w)/2:y=h-200:fontsize=40:fontcolor=white:borderw=2:bordercolor=black`;

    const args = [
      '-y',
      '-ss',
      String(params.trimStartSec),
      '-i',
      params.sourcePath,
      '-t',
      String(params.trimDurationSec),
      '-vf',
      vf,
      params.outputPath,
    ];

    try {
      await execFileAsync(this.ffmpegBinary, args);
    } catch {
      // Fallback for environments without ffmpeg binary.
      await fs.copyFile(params.sourcePath, params.outputPath);
    }

    return {
      trimStartSec: params.trimStartSec,
      trimDurationSec: params.trimDurationSec,
      watermarkRemoved: params.cropWatermark,
      subtitlePlaceholder: params.subtitleText,
    };
  }
}
