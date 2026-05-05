export const CRAWL_QUEUE = 'crawl_queue';
export const PROCESS_QUEUE = 'process_queue';
export const PUBLISH_QUEUE = 'publish_queue';
export const QUEUE_NAMES = {
  CRAWL: CRAWL_QUEUE,
  PROCESS: PROCESS_QUEUE,
  PUBLISH: PUBLISH_QUEUE,
} as const;

export const JOB_NAMES = {
  CRAWL_BATCH: 'crawl.batch',
  PROCESS_VIDEO: 'process.video',
  PUBLISH_VARIANT: 'publish.variant',
} as const;

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_BACKOFF_MS = 5000;
