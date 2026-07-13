/**
 * @file Campaigns router — exposes campaign lists and statuses.
 */

import { Router, Request, Response } from 'express';
import { getCampaigns, getActiveCampaigns } from '../db/queries.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/campaigns
 * Returns all campaigns.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaigns = await getCampaigns();
    res.json({ campaigns });
  } catch (err) {
    logger.error('Failed to fetch campaigns', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/**
 * GET /api/campaigns/active
 * Returns currently active campaigns.
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const active = await getActiveCampaigns();
    res.json({ campaigns: active });
  } catch (err) {
    logger.error('Failed to fetch active campaigns', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch active campaigns' });
  }
});

export default router;
