/**
 * @file Generate demo route.
 * POST /api/generate-demo — queues AI + demo generation for a lead.
 * GET  /api/generate-demo/:id/preview — returns raw HTML for preview.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { generateQueue } from '../lib/queue.js';
import { getLeadById } from '../db/queries.js';
import logger from '../lib/logger.js';

const router = Router();

const generateSchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * POST /api/generate-demo
 * Body: { leadId }
 * Queues a demo generation job for the given lead.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { leadId } = generateSchema.parse(req.body);

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.demo_status === 'deployed') {
      return res.status(200).json({
        message: 'Demo already deployed',
        demoUrl: lead.demo_url,
      });
    }

    const jobId = uuidv4();
    await generateQueue.add('generate-demo' as any, {
      jobId,
      leadId,
      demo_mode: lead.demo_mode ?? 'ai_scratch',
    }, { jobId: `gen-${leadId}` });

    logger.info(`Demo generation queued for lead ${leadId}`, { jobId });

    res.status(202).json({
      jobId,
      leadId,
      message: `Demo generation queued — stream progress at /api/events?jobId=${jobId}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to queue demo generation', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to queue demo generation' });
  }
});

/**
 * POST /api/generate-demo/retry-failed
 * Re-queues all leads with demo_status = 'failed' for demo generation.
 */
router.post('/retry-failed', async (_req: Request, res: Response) => {
  try {
    const { getLeads } = await import('../db/queries.js');
    const failedLeads = await getLeads({ demo_status: 'failed' as any }, 100, 0);

    let queued = 0;
    for (const lead of failedLeads) {
      const jobId = uuidv4();
      await generateQueue.add('generate-demo' as any, {
        jobId,
        leadId: lead.id,
        demo_mode: lead.demo_mode ?? 'ai_scratch',
      }, { jobId: `gen-${lead.id}` });
      queued++;
    }

    logger.info(`Retry failed demos: queued ${queued} jobs`);
    res.json({ queued, message: `Re-queued ${queued} failed demo generations` });
  } catch (err) {
    logger.error('Failed to retry failed demos', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to retry failed demos' });
  }
});

/**
 * GET /api/generate-demo/:id/preview
 * Returns the raw demo HTML for preview in the dashboard iframe.
 */
router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.demo_html) return res.status(404).json({ error: 'Demo not yet generated' });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(lead.demo_html);
  } catch (err) {
    logger.error('Failed to get demo preview', { id: req.params.id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to get demo preview' });
  }
});

export default router;
