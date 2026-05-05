import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Caption } from '@prisma/client';
import OpenAI from 'openai';

import { AppLoggerService } from '../common/logging/app-logger.service';
import { MetricsService } from '../common/monitoring/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateCaptionsJobDto } from './dto/generate-captions-job.dto';

const FALLBACK_HOOKS = [
  'Dung bo lo clip nay',
  'Xem ngay meo nay',
  'Ai xem cung cuon',
  'Noi dung nay dang hot',
  'Ban se thay bat ngo',
];

type CaptionVariant = {
  variant: number;
  content: string;
};

@Injectable()
export class CaptionsService {
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
    private readonly logger: AppLoggerService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generateAndStoreVariants(job: GenerateCaptionsJobDto): Promise<Caption[]> {
    const video = await this.prisma.video.findUnique({
      where: { id: job.videoId },
    });
    if (!video) {
      throw new Error(`Video ${job.videoId} not found`);
    }

    const variants = await this.generateThreeVariants(video.description);
    const saved = await this.prisma.$transaction(
      variants.map((variant) =>
        this.prisma.caption.upsert({
          where: {
            videoId_variant: {
              videoId: job.videoId,
              variant: variant.variant,
            },
          },
          create: {
            videoId: job.videoId,
            variant: variant.variant,
            content: variant.content,
            openaiModel: this.model,
          },
          update: {
            content: variant.content,
            openaiModel: this.model,
          },
        }),
      ),
    );

    this.metrics.incrementCounter('caption.generated.total', saved.length);
    return saved;
  }

  async pickBestVariant(videoId: string): Promise<Caption | null> {
    const captions = await this.prisma.caption.findMany({
      where: { videoId },
    });
    if (captions.length === 0) {
      return null;
    }

    const scored = captions
      .map((caption) => {
        const ctr = caption.impressions > 0 ? caption.clicks / caption.impressions : 0;
        const score = ctr * 0.6 + caption.engagementScore * 0.4 + caption.posts * 0.1;
        return { caption, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.caption;
    if (!best) {
      return null;
    }

    await this.prisma.caption.updateMany({
      where: { videoId },
      data: { isBest: false },
    });
    await this.prisma.caption.update({
      where: { id: best.id },
      data: { isBest: true },
    });

    this.metrics.incrementCounter('caption.best.selected');
    return best;
  }

  private async generateThreeVariants(description: string): Promise<CaptionVariant[]> {
    if (!this.openai) {
      return this.fallbackCaptions(description);
    }

    const prompt = `
Generate 3 Vietnamese TikTok captions from this input.
Requirements:
- Under 100 characters each
- First 5 words must be engaging hook
- Return ONLY strict JSON array of 3 strings
Input: ${description}
    `.trim();

    try {
      const response = await this.openai.responses.create({
        model: this.model,
        input: prompt,
      });
      const raw = response.output_text ?? '[]';
      const parsed = this.parseResponse(raw);
      if (parsed.length < 3) {
        return this.fallbackCaptions(description);
      }
      return parsed.slice(0, 3).map((content, idx) => ({
        variant: idx + 1,
        content: this.normalizeCaption(content),
      }));
    } catch (error) {
      this.logger.error(
        {
          event: 'caption.openai.failed',
          error: error instanceof Error ? error.message : String(error),
        },
        undefined,
        CaptionsService.name,
      );
      this.metrics.incrementCounter('caption.openai.error');
      return this.fallbackCaptions(description);
    }
  }

  private parseResponse(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => String(item)).filter(Boolean);
    } catch {
      return raw
        .split('\n')
        .map((line) => line.replace(/^\d+[\).\s-]*/, '').trim())
        .filter(Boolean);
    }
  }

  private fallbackCaptions(description: string): CaptionVariant[] {
    const base = description.slice(0, 70).trim() || 'video trend dang hot';
    return Array.from({ length: 3 }, (_, idx) => {
      const hook = FALLBACK_HOOKS[idx % FALLBACK_HOOKS.length];
      return {
        variant: idx + 1,
        content: this.normalizeCaption(`${hook} ${base}`),
      };
    });
  }

  private normalizeCaption(input: string): string {
    let text = input.replace(/\s+/g, ' ').trim();
    if (text.length > 100) {
      text = `${text.slice(0, 97).trimEnd()}...`;
    }
    const words = text.split(' ').filter(Boolean);
    if (words.length < 5) {
      text = `Xem ngay clip nay ${text}`.trim();
      if (text.length > 100) {
        text = `${text.slice(0, 97).trimEnd()}...`;
      }
    }
    return text;
  }
}
