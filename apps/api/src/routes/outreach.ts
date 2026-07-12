/**
 * @file Outreach API routes.
 * POST /api/outreach/generate  — generate email copy for a lead (AI)
 * POST /api/outreach/send      — send email immediately via Resend
 * POST /api/outreach/queue     — queue email for later sending
 * POST /api/outreach/bulk-send — bulk send to multiple leads
 * POST /api/outreach/webhook   — Resend webhook for open/click tracking
 * GET  /api/outreach/campaigns — list all campaigns with stats
 * POST /api/outreach/campaigns — create a new campaign
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getLeadById,
  getLeads,
  updateLeadOutreach,
  logOutreachEvent,
  getCampaigns,
  createCampaign,
  markEmailOpened,
} from '../db/queries.js';
import { outreachQueue } from '../lib/queue.js';
import { writeEmail } from '../services/ai/writeEmail.js';
import { sendEmailNow } from '../services/outreach/email.js';
import logger from '../lib/logger.js';

const router = Router();

// ─── Generate Email Copy ─────────────────────────────────────────────────────

/**
 * POST /api/outreach/generate
 * Generates cold email copy for a lead using Claude AI.
 * Does NOT send — just saves subject + body to DB.
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ leadId: z.string().uuid() });
    const { leadId } = schema.parse(req.body);

    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.demo_url) {
      return res.status(400).json({ error: 'Deploy demo first before generating email' });
    }

    const email = await writeEmail(lead, lead.demo_url);
    await updateLeadOutreach(leadId, email.subject, email.body, 'queued');

    res.json({ subject: email.subject, body: email.body });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    logger.error('Email generation failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to generate email: ' + (err as Error).message });
  }
});

// ─── Send Email Now ───────────────────────────────────────────────────────────

/**
 * POST /api/outreach/send
 * Sends the email for a lead immediately via Resend.
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ leadId: z.string().uuid() });
    const { leadId } = schema.parse(req.body);

    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.email) return res.status(400).json({ error: 'Lead has no email address' });
    if (!lead.email_subject || !lead.email_body) {
      return res.status(400).json({ error: 'Generate email copy first before sending' });
    }
    if (lead.outreach_status === 'sent') {
      return res.status(200).json({ message: 'Email already sent', sentAt: lead.email_sent_at });
    }

    const emailId = await sendEmailNow(
      leadId,
      lead.email,
      lead.email_subject,
      lead.email_body,
      lead.business_name
    );

    res.json({ emailId, message: 'Email sent successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    logger.error('Email send failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to send email: ' + (err as Error).message });
  }
});

// ─── Queue Email ──────────────────────────────────────────────────────────────

/**
 * POST /api/outreach/queue
 * Adds a lead's outreach to the BullMQ queue for processing.
 */
router.post('/queue', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ leadId: z.string().uuid() });
    const { leadId } = schema.parse(req.body);

    const jobId = uuidv4();
    await outreachQueue.add('send-outreach' as any, { jobId, leadId }, { jobId: `outreach-${leadId}` });

    res.status(202).json({ jobId, message: 'Outreach queued' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    res.status(500).json({ error: 'Failed to queue outreach' });
  }
});

// ─── Bulk Send ────────────────────────────────────────────────────────────────

/**
 * POST /api/outreach/bulk-send
 * Queues outreach for all leads in a campaign that have demo_url but haven't been emailed.
 */
router.post('/bulk-send', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      campaignId: z.string().uuid().optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
    });
    const { campaignId, limit } = schema.parse(req.body);

    const leads = await getLeads(
      {
        campaign_id: campaignId,
        outreach_status: 'queued' as const,
        demo_status: 'deployed' as const,
      },
      limit,
      0
    );

    let queued = 0;
    for (const lead of leads) {
      if (!lead.email || !lead.email_subject) continue;
      const jobId = uuidv4();
      await outreachQueue.add('send-outreach' as any, { jobId, leadId: lead.id }, {
        jobId: `outreach-${lead.id}`,
      });
      queued++;
    }

    res.json({ queued, message: `Queued ${queued} outreach emails` });
  } catch (err) {
    logger.error('Bulk send failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Bulk send failed' });
  }
});

// ─── Resend Webhook ───────────────────────────────────────────────────────────

/**
 * POST /api/outreach/webhook
 * Receives Resend email event webhooks (open, click, bounce, reply).
 * Updates lead status and logs events.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body as {
      type: string;
      data: { tags?: Array<{ name: string; value: string }> };
    };

    // Extract lead_id from email tags
    const leadId = event.data?.tags?.find((t) => t.name === 'lead_id')?.value;
    if (!leadId) return res.status(200).json({ ok: true });

    const eventType = event.type?.replace('email.', '') ?? 'unknown';
    await logOutreachEvent(leadId, eventType, { webhook_payload: event });

    // Update lead status for opens
    if (eventType === 'opened') {
      await markEmailOpened(leadId);
    }

    logger.info(`Webhook received: ${eventType} for lead ${leadId}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('Webhook processing failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

/** GET /api/outreach/campaigns */
router.get('/campaigns', async (_req: Request, res: Response) => {
  try {
    const campaigns = await getCampaigns();
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/** POST /api/outreach/campaigns */
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      niche: z.string().min(1).max(100),
      city: z.string().min(1).max(100),
    });
    const data = schema.parse(req.body);
    const campaign = await createCampaign(data);
    res.status(201).json(campaign);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

export default router;
