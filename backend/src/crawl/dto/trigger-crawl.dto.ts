import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TriggerCrawlDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  batchSize?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
