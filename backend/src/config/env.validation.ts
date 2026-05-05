import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_HOST = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsInt()
  @Min(0)
  REDIS_DB = 0;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsString()
  VIDEO_STORAGE_DIR = './storage';

  @IsString()
  FFMPEG_BINARY = 'ffmpeg';

  @IsInt()
  @Min(1)
  CRAWL_BATCH_SIZE = 30;

  @IsInt()
  @Min(1)
  WORKER_CONCURRENCY = 4;

  @IsInt()
  @Min(1)
  MAX_JOB_ATTEMPTS = 3;

  @IsInt()
  @Min(100)
  JOB_RETRY_BACKOFF_MS = 2000;

  @IsInt()
  @Min(1)
  CRAWL_INTERVAL_HOURS = 6;

  @IsInt()
  @Min(0)
  CRAWL_MIN_LIKES = 50000;

  @IsInt()
  @Min(0)
  CRAWL_MIN_COMMENTS = 5000;

  @Min(0)
  @Max(1)
  TOP_PERCENT = 0.2;

  @IsIn(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
  CROP_WATERMARK = 'true';

  @IsIn(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
  SCHEDULER_ENABLED = 'true';

  @IsString()
  OPENAI_MODEL = 'gpt-4o-mini';

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;
}

export type AppEnvironment = EnvironmentVariables;

export function validateEnvironment(config: Record<string, unknown>): AppEnvironment {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors
        .map((error) => JSON.stringify(error.constraints))
        .join(', ')}`,
    );
  }

  return validatedConfig;
}
