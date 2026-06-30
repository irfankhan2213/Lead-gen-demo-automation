/**
 * @file BullMQ scrape worker.
 * Processes jobs from the 'scrape' queue.
 * Each job scrapes Google Maps for a niche+city, enriches each business,
 * runs AI analysis, and queues demo generation for high-score leads.
 */

import { Worker, Job } from 'bullmq';
import logger from '../lib/logger.js';
import { redisConnection } from '../lib/queue.js';
import { scrapeFullBusinessProfile } from '../services/scraper/index.js';
import type { ScrapeJobData } from '@acquisition-engine/shared';

const worker = new Worker<ScrapeJobData>(
  'scrape',
  async (job: Job<ScrapeJobData>) => {
    logger.info(`[ScrapeWorker] Processing job ${job.id}`, {
      niche: job.data.niche,
      city: job.data.city,
    });

    await scrapeFullBusinessProfile({
      jobId: job.data.jobId,
      niche: job.data.niche,
      city: job.data.city,
      businessName: job.data.businessName,
      campaignId: job.data.campaignId,
    });

    logger.info(`[ScrapeWorker] Job ${job.id} complete`);
  },
  {
    connection: redisConnection as any,
    concurrency: 1, // One at a time — scraping is heavy
    limiter: {
      max: 5,
      duration: 60_000, // Max 5 scrape jobs per minute
    },
  }
);

worker.on('completed', (job) => {
  logger.info(`[ScrapeWorker] ✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`[ScrapeWorker] ❌ Job ${job?.id} failed`, { error: err.message });
});

worker.on('error', (err) => {
  logger.error('[ScrapeWorker] Worker error', { error: err.message });
});

logger.info('[ScrapeWorker] Started, waiting for jobs...');

export default worker;
