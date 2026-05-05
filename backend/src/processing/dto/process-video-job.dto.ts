import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ProcessVideoJobDto {
  @IsString()
  videoId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  variant?: number;
}
