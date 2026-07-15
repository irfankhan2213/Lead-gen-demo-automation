/**
 * @file Scrape API route.
 * POST /api/scrape — initiates a new scrape job for a niche+city combination.
 * Returns a jobId immediately; progress streamed via SSE at GET /api/events.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { scrapeQueue, generationQueue } from '../lib/queue.js';
import { createCampaign } from '../db/queries.js';
import db from '../db/client.js';
import logger from '../lib/logger.js';

const router = Router();

// Strict rate limiting for scrape endpoint
const scrapeRateLimit = rateLimit({
  windowMs: parseInt(process.env.SCRAPE_RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  max: parseInt(process.env.SCRAPE_RATE_LIMIT_MAX ?? '10', 10),
  message: { error: 'Too many scrape requests, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const scrapeSchema = z.object({
  niche: z.string().min(2).max(100).trim(),
  city: z.string().min(2).max(100).trim(),
  businessName: z.string().max(255).trim().optional(),
  campaignName: z.string().max(255).trim().optional(),
  limit: z.union([z.number().min(1), z.literal('unlimited')]).optional().default(20),
  demo_mode: z.enum(['template', 'ai_scratch']).optional(),
});

/**
 * POST /api/scrape
 * Body: { niche, city, businessName?, campaignName? }
 * Response: { jobId, campaignId, message }
 */
router.post('/', scrapeRateLimit, async (req: Request, res: Response) => {
  try {
    const { niche, city, businessName, campaignName, limit } = scrapeSchema.parse(req.body);
    const jobId = uuidv4();

    // Create a campaign record
    const campaign = await createCampaign({
      name: campaignName ?? `${niche} in ${city} — ${new Date().toLocaleDateString()}`,
      niche,
      city,
      demo_mode: req.body.demo_mode,
      job_id: jobId,
    });

    // Enqueue the scrape job
    await scrapeQueue.add('scrape-businesses' as any, {
      jobId,
      niche,
      city,
      businessName,
      campaignId: campaign.id,
      limit,
      demo_mode: req.body.demo_mode,
    }, { jobId });

    logger.info(`Scrape job queued: ${jobId}`, { niche, city, campaignId: campaign.id });

    res.status(202).json({
      jobId,
      campaignId: campaign.id,
      message: `Scraping "${niche}" businesses in "${city}" — stream progress at /api/events?jobId=${jobId}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to queue scrape job', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to start scrape job' });
  }
});

/**
 * DELETE /api/scrape/:jobId
 * Cancels (removes) a queued or active scrape job.
 * Response: { success, message }
 */
router.delete('/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  try {
    // 1. Mark campaign as stopped in DB
    const resDb = await db.query(
      `UPDATE campaigns SET status = 'stopped' WHERE job_id = $1 RETURNING id`,
      [jobId]
    );
    const campaignId = resDb.rows[0]?.id;

    // 2. Remove the scrape job
    const job = await scrapeQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }

    // 3. Remove all queued generation jobs for this campaign
    if (campaignId) {
      const waiting = await generationQueue.getWaiting();
      const delayed = await generationQueue.getDelayed();
      for (const genJob of [...waiting, ...delayed]) {
        if (genJob.data?.campaignId === campaignId) {
          await genJob.remove();
        }
      }
    }

    logger.info(`Campaign ${campaignId || jobId} fully stopped and queues cleared.`);
    res.json({ success: true, message: `Campaign stopped.` });
  } catch (err) {
    logger.error('Failed to cancel campaign', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

export default router;
