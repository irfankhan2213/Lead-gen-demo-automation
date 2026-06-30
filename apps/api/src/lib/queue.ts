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

const getRedisOptions = () => {
  const options: any = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  };

  // 1. Try individual Railway environment variables first (most reliable)
  if (process.env.REDISHOST) {
    options.host = process.env.REDISHOST;
    options.port = process.env.REDISPORT ? parseInt(process.env.REDISPORT, 10) : 6379;
    options.username = process.env.REDISUSER || 'default';
    options.password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;
    if (process.env.REDIS_TLS === 'true' || (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss:'))) {
      options.tls = { rejectUnauthorized: false };
    }
    return options;
  }

  // 2. Fall back to parsing REDIS_URL
  try {
    const parsed = new URL(redisUrl);
    options.host = parsed.hostname;
    options.port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    
    if (parsed.username) {
      options.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      options.password = decodeURIComponent(parsed.password);
    }
    if (parsed.protocol === 'rediss:') {
      options.tls = { rejectUnauthorized: false };
    }
  } catch (err) {
    logger.warn('Failed to parse REDIS_URL with URL parser, using direct fallback', { error: (err as Error).message });
  }

  return options;
};

// If parsing succeeded, instantiate using options, otherwise fall back to url string
let redisOptions = getRedisOptions();
export const redisConnection = redisOptions.host 
  ? new Redis(redisOptions)
  : new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

redisConnection.on('connect', () => logger.info('Redis connected successfully'));
redisConnection.on('error', (err: any) => logger.error('Redis connection error', { error: err.message }));

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
