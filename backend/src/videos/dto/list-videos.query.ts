import { IsBooleanString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListVideosQueryDto {
  @IsOptional()
  @IsIn(['NEW', 'QUEUED', 'PROCESSING', 'PROCESSED', 'PUBLISHED', 'FAILED'])
  status?: 'NEW' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'PUBLISHED' | 'FAILED';

  @IsOptional()
  @IsBooleanString()
  topOnly?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
