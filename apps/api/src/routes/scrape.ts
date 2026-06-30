/**
 * @file Scrape API route.
 * POST /api/scrape — initiates a new scrape job for a niche+city combination.
 * Returns a jobId immediately; progress streamed via SSE at GET /api/events.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { scrapeQueue } from '../lib/queue.js';
import { createCampaign } from '../db/queries.js';
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
});

/**
 * POST /api/scrape
 * Body: { niche, city, businessName?, campaignName? }
 * Response: { jobId, campaignId, message }
 */
router.post('/', scrapeRateLimit, async (req: Request, res: Response) => {
  try {
    const { niche, city, businessName, campaignName } = scrapeSchema.parse(req.body);
    const jobId = uuidv4();

    // Create a campaign record
    const campaign = await createCampaign({
      name: campaignName ?? `${niche} in ${city} — ${new Date().toLocaleDateString()}`,
      niche,
      city,
    });

    // Enqueue the scrape job
    await scrapeQueue.add('scrape-businesses' as any, {
      jobId,
      niche,
      city,
      businessName,
      campaignId: campaign.id,
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
    const job = await scrapeQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }

    // Remove job and obliterate from queue
    await job.remove();

    logger.info(`Scrape job cancelled: ${jobId}`);
    res.json({ success: true, message: `Campaign ${jobId} cancelled` });
  } catch (err) {
    logger.error('Failed to cancel scrape job', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

export default router;
