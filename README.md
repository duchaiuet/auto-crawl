# Short Video Automation Pipeline (NestJS)

Production-ready backend for automating short-video processing and publishing.

## Tech stack

- Node.js + NestJS
- PostgreSQL + Prisma ORM
- Redis + BullMQ
- FFmpeg (with fallback in environments without ffmpeg)
- OpenAI API for caption generation

## Implemented features

### 1) Video crawling module
- Mock Douyin-like crawler provides:
  - `id`
  - `url`
  - `like_count`
  - `comment_count`
  - `description`
- Filtering:
  - `like_count > 50_000`
  - `comment_count > 5_000`
- Scoring:
  - `score = like_count * 0.7 + comment_count * 0.3`
- Top selection:
  - Only top 20% are pushed to processing queue

### 2) Video download worker
- Mock download from URL to local storage path
- Worker persists local file path
- Watermark removal strategy supported via crop flag (`CROP_WATERMARK`)

### 3) Video processing module
- FFmpeg pipeline:
  - random trim segment (10-20s)
  - resize to 9:16
  - add subtitle placeholder
- Output processed video record

### 4) Caption generation
- OpenAI integration via `responses.create`
- Input: original video description
- Output:
  - 3 Vietnamese caption variants
  - under 100 chars (normalized)
  - with hook-first behavior
- Includes fallback generator if API key is missing/error

### 5) Queue system
- Queues:
  - `crawl_queue`
  - `process_queue`
  - `publish_queue`
- Flow:
  - `crawl -> process -> caption -> publish`
  - caption step is executed inside process worker before publish enqueue

### 6) Scheduler
- Cron every 6 hours via Nest Schedule
- Auto-enqueue crawl job if `SCHEDULER_ENABLED=true`

### 7) Publish module (mock)
- Simulate posting to TikTok
- Log processed video + caption
- Mark video status as `PUBLISHED`

### 8) Database schema
Prisma models:
- `videos`
- `processed_videos`
- `captions`
- `jobs`

### 9) API
- `GET /videos`
- `GET /processed`
- `POST /trigger-crawl`
- `GET /monitoring/summary`

### 10) Reliability + ops
- Modular NestJS structure (modules/services/dto/processors)
- Queue retry with exponential backoff
- DB job tracking with status transitions
- Metrics service + monitoring endpoint
- Concurrent workers on queue processors

## A/B testing behavior

- Each video generates 3 caption variants
- Publish queue enqueues each variant
- Variant performance fields tracked:
  - impressions
  - clicks
  - posts
  - engagement_score
- Best variant selected by score:
  - `ctr * 0.6 + engagement_score * 0.4 + posts * 0.1`

## Project structure

```text
backend/
  prisma/
    schema.prisma
  src/
    app.module.ts
    main.ts
    config/
      env.validation.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    common/
      logging/
      monitoring/
      utils/
    queues/
      queue.module.ts
      constants/queue.constants.ts
    crawl/
    processing/
    captions/
    publish/
    jobs/
      processors/
    videos/
    scheduler/
```

## Environment

Use `backend/.env.example` as reference:

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `VIDEO_STORAGE_DIR`
- `CRAWL_BATCH_SIZE`
- `WORKER_CONCURRENCY`
- `MAX_JOB_ATTEMPTS`
- `JOB_RETRY_BACKOFF_MS`
- `CRAWL_INTERVAL_HOURS`
- `CRAWL_MIN_LIKES`
- `CRAWL_MIN_COMMENTS`
- `TOP_PERCENT`
- `CROP_WATERMARK`
- `SCHEDULER_ENABLED`

## Local run

```bash
cd backend
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Trigger crawl:

```bash
curl -X POST http://localhost:3000/trigger-crawl \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 30, "source": "manual"}'
```

## Bonus dashboard

Simple dashboard module was not implemented in this iteration; monitoring endpoint and API data are ready for a Next.js dashboard integration.
