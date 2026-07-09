/**
 * @file Leads CRUD API routes.
 * GET /api/leads           — list leads with filters
 * GET /api/leads/stats     — dashboard stats
 * GET /api/leads/:id       — single lead
 * PATCH /api/leads/:id     — update lead fields
 * GET /api/leads/:id/log   — outreach log for a lead
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getLeads,
  getLeadById,
  getDashboardStats,
  getOutreachLogForLead,
  clearLeadDemo,
} from '../db/queries.js';
import { pool } from '../db/queries.js';
import { deleteDemoFromVercel } from '../services/hosting/vercel.js';
import logger from '../lib/logger.js';

const router = Router();

// GET /api/leads/stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    logger.error('Failed to get stats', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/leads — with optional query filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const querySchema = z.object({
      niche: z.string().optional(),
      city: z.string().optional(),
      outreach_status: z.string().optional(),
      demo_status: z.string().optional(),
      campaign_id: z.string().uuid().optional(),
      min_score: z.coerce.number().min(1).max(10).optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
    });

    const { limit, offset, ...filters } = querySchema.parse(req.query);
    const leads = await getLeads(filters as Parameters<typeof getLeads>[0], limit, offset);
    res.json({ leads, count: leads.length, offset });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query params', details: err.errors });
    }
    logger.error('Failed to list leads', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    logger.error('Failed to get lead', { id: req.params.id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// GET /api/leads/:id/log
router.get('/:id/log', async (req: Request, res: Response) => {
  try {
    const log = await getOutreachLogForLead(req.params.id);
    res.json({ log });
  } catch (err) {
    logger.error('Failed to get outreach log', { id: req.params.id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// DELETE /api/leads/:id/demo — delete the Vercel demo and clear it from the DB
router.delete('/:id/demo', async (req: Request, res: Response) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    
    if (lead.vercel_deployment_id) {
      try {
        await deleteDemoFromVercel(lead.vercel_deployment_id);
      } catch (vercelErr) {
        logger.warn(`Failed to delete Vercel deployment for lead ${lead.id}`, { error: (vercelErr as Error).message });
      }
    }

    const updatedLead = await clearLeadDemo(req.params.id);
    res.json({ message: 'Demo deleted successfully', lead: updatedLead });
  } catch (err) {
    logger.error('Failed to delete demo', { id: req.params.id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to delete demo' });
  }
});

// PATCH /api/leads/:id — update outreach_status or other fields
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const patchSchema = z.object({
      outreach_status: z.enum(['pending', 'queued', 'sent', 'opened', 'replied', 'booked', 'lost']).optional(),
      email: z.string().email().optional(),
      reply_text: z.string().optional(),
    });

    const patch = patchSchema.parse(req.body);
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (patch.outreach_status) {
      setClauses.push(`outreach_status = $${idx++}`);
      values.push(patch.outreach_status);
    }
    if (patch.email) {
      setClauses.push(`email = $${idx++}`);
      values.push(patch.email);
    }
    if (patch.reply_text) {
      setClauses.push(`reply_text = $${idx++}, reply_received_at = NOW()`);
      values.push(patch.reply_text);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.params.id);
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE leads SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    logger.error('Failed to update lead', { id: req.params.id, error: (err as Error).message });
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

export default router;
