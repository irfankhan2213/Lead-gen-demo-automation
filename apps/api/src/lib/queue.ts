/**
 * @file BullMQ queue definitions and Redis connection.
 * Provides named queues for scraping, demo generation, and outreach.
 */

import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import logger from './logger.js';
import type { ScrapeJobData, GenerateJobData, OutreachJobData } from '@acquisition-engine/shared';

import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const url = new URL(redisUrl);

export const redisConnection = new Redis({
  host: url.hostname,
  port: parseInt(url.port || '6379', 10),
  username: url.username || undefined,
  password: url.password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err: any) => logger.error('Redis error', { error: err.message }));

// ─── Queue Config ─────────────────────────────────────────────────────────────

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

// ─── Queue Instances ──────────────────────────────────────────────────────────

/** Queue for scraping jobs — processes Google Maps + enrichment */
export const scrapeQueue = new Queue<ScrapeJobData>('scrape', {
  connection: redisConnection as any,
  defaultJobOptions,
});

/** Queue for AI demo generation jobs */
export const generateQueue = new Queue<GenerateJobData>('generate', {
  connection: redisConnection as any,
  defaultJobOptions,
});

/** Queue for email outreach jobs */
export const outreachQueue = new Queue<OutreachJobData>('outreach', {
  connection: redisConnection as any,
  defaultJobOptions,
});

logger.info('BullMQ queues initialized');
