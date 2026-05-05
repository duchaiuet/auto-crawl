import { IsString } from 'class-validator';

export class PublishJobDto {
  @IsString()
  videoId!: string;

  @IsString()
  processedVideoId!: string;

  @IsString()
  captionId!: string;
}
