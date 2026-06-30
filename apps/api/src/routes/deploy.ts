/**
 * @file Deploy route.
 * POST /api/deploy — immediately deploys a generated demo to Vercel.
 * Used for manual trigger from the dashboard; auto-deploy happens via BullMQ worker.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getLeadById, updateLeadDeployment } from '../db/queries.js';
import { deployDemoToVercel } from '../services/hosting/vercel.js';
import logger from '../lib/logger.js';

const router = Router();

const deploySchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * POST /api/deploy
 * Body: { leadId }
 * Deploys the lead's generated HTML to Vercel and returns the live URL.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { leadId } = deploySchema.parse(req.body);

    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.demo_html) {
      return res.status(400).json({ error: 'Demo HTML not generated yet. Generate demo first.' });
    }

    // If already deployed, return existing URL
    if (lead.demo_status === 'deployed' && lead.demo_url) {
      return res.json({
        demoUrl: lead.demo_url,
        deploymentId: lead.vercel_deployment_id,
        cached: true,
      });
    }

    logger.info(`Manually deploying demo for ${lead.business_name}`);

    const { demoUrl, deploymentId } = await deployDemoToVercel(
      leadId,
      lead.business_name ?? 'business',
      lead.demo_html
    );

    await updateLeadDeployment(leadId, demoUrl, deploymentId);

    res.json({ demoUrl, deploymentId, cached: false });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Deploy failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Deployment failed: ' + (err as Error).message });
  }
});

export default router;
