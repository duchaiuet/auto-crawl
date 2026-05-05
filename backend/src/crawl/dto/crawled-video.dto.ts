import { IsInt, IsString, Min } from 'class-validator';

export class CrawledVideoDto {
  @IsString()
  sourceId!: string;

  @IsString()
  url!: string;

  @IsInt()
  @Min(0)
  likeCount!: number;

  @IsInt()
  @Min(0)
  commentCount!: number;

  @IsString()
  description!: string;
}
