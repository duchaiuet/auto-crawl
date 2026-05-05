import { IsString } from 'class-validator';

export class GenerateCaptionsJobDto {
  @IsString()
  videoId!: string;
}

export type CaptionABPerformance = {
  captionId: string;
  variant: number;
  engagementScore: number;
  impressions: number;
  clicks: number;
  posts: number;
};
