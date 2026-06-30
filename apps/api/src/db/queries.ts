/**
 * @file All database query functions for the Acquisition Engine.
 * No raw SQL should appear outside this file.
 * Uses the `pg` Pool for connection management.
 */

import { Pool, PoolClient, QueryResultRow } from 'pg';
import logger from '../lib/logger.js';
import type {
  Lead,
  LeadData,
  Campaign,
  OutreachLog,
  DashboardStats,
  OutreachStatus,
  DemoStatus,
} from '@acquisition-engine/shared';

import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Supabase requires SSL; local Docker does not — auto-detect
  ssl: process.env.DATABASE_URL?.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => logger.error('Unexpected DB pool error', { error: err.message }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Run a query using the pool (auto-releases connection) */
async function query<T extends QueryResultRow = any>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/** Run multiple queries in a transaction */
async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

/**
 * Creates a new lead from scraped data.
 * @param data - Scraped and merged lead data
 * @returns The newly created lead record
 */
export async function createLead(data: LeadData): Promise<Lead> {
  const rows = await query<Lead>(
    `INSERT INTO leads (
      campaign_id, niche, city, business_name, owner_name, website_url,
      phone, email, address, google_maps_url, google_rating, google_review_count,
      brand_colors, brand_fonts, tagline, about_text, services,
      menu_or_pricing, social_links, reddit_mentions, yelp_reviews_summary,
      instagram_bio, instagram_post_themes, demo_status, outreach_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20, $21,
      $22, $23, 'none', 'pending'
    ) RETURNING *`,
    [
      data.campaign_id ?? null,
      data.niche,
      data.city,
      data.business_name,
      data.owner_name ?? null,
      data.website_url ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.address ?? null,
      data.google_maps_url ?? null,
      data.google_rating ?? null,
      data.google_review_count ?? null,
      JSON.stringify(data.brand_colors ?? []),
      JSON.stringify(data.brand_fonts ?? []),
      data.tagline ?? null,
      data.about_text ?? null,
      JSON.stringify(data.services ?? []),
      JSON.stringify(data.menu_or_pricing ?? []),
      JSON.stringify(data.social_links ?? {}),
      JSON.stringify(data.reddit_mentions ?? []),
      data.yelp_reviews_summary ?? null,
      data.instagram_bio ?? null,
      data.instagram_post_themes ?? null,
    ]
  );
  return rows[0];
}

/**
 * Fetches all leads with optional filters.
 * @param filters - Optional filter criteria
 * @param limit - Max results (default 50)
 * @param offset - Pagination offset
 */
export async function getLeads(
  filters: {
    niche?: string;
    city?: string;
    outreach_status?: OutreachStatus;
    demo_status?: DemoStatus;
    campaign_id?: string;
    min_score?: number;
  } = {},
  limit = 50,
  offset = 0
): Promise<Lead[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.niche) { conditions.push(`niche = $${idx++}`); params.push(filters.niche); }
  if (filters.city) { conditions.push(`city = $${idx++}`); params.push(filters.city); }
  if (filters.outreach_status) { conditions.push(`outreach_status = $${idx++}`); params.push(filters.outreach_status); }
  if (filters.demo_status) { conditions.push(`demo_status = $${idx++}`); params.push(filters.demo_status); }
  if (filters.campaign_id) { conditions.push(`campaign_id = $${idx++}`); params.push(filters.campaign_id); }
  if (filters.min_score) { conditions.push(`opportunity_score >= $${idx++}`); params.push(filters.min_score); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  return query<Lead>(
    `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    params
  );
}

/**
 * Fetches a single lead by ID.
 * @param id - Lead UUID
 */
export async function getLeadById(id: string): Promise<Lead | null> {
  const rows = await query<Lead>('SELECT * FROM leads WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Updates a lead with AI analysis results.
 * @param id - Lead UUID
 * @param analysis - AI analysis output to merge
 */
export async function updateLeadAIAnalysis(
  id: string,
  analysis: {
    brand_dna: string;
    tone: string;
    pain_points: string[];
    opportunity_score: number;
    opportunity_reason: string;
    recommended_template: string;
    hero_headline: string;
    hero_subline: string;
    cta_text: string;
    primary_colors?: string[];
  }
): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET
      brand_dna = $1, tone = $2, pain_points = $3, opportunity_score = $4,
      opportunity_reason = $5, recommended_template = $6, hero_headline = $7,
      hero_subline = $8, cta_text = $9, brand_colors = COALESCE($10, brand_colors)
    WHERE id = $11 RETURNING *`,
    [
      analysis.brand_dna,
      analysis.tone,
      JSON.stringify(analysis.pain_points),
      analysis.opportunity_score,
      analysis.opportunity_reason,
      analysis.recommended_template,
      analysis.hero_headline,
      analysis.hero_subline,
      analysis.cta_text,
      analysis.primary_colors ? JSON.stringify(analysis.primary_colors) : null,
      id,
    ]
  );
  return rows[0];
}

/**
 * Updates a lead's demo fields after generation.
 * @param id - Lead UUID
 * @param demoHtml - Generated HTML string
 * @param status - New demo status
 */
export async function updateLeadDemo(
  id: string,
  demoHtml: string,
  status: DemoStatus = 'ready'
): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET demo_html = $1, demo_status = $2 WHERE id = $3 RETURNING *`,
    [demoHtml, status, id]
  );
  return rows[0];
}

/**
 * Updates a lead's deployed demo URL after Vercel deployment.
 * @param id - Lead UUID
 * @param demoUrl - Live demo URL
 * @param deploymentId - Vercel deployment ID
 */
export async function updateLeadDeployment(
  id: string,
  demoUrl: string,
  deploymentId: string
): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET
      demo_url = $1, vercel_deployment_id = $2,
      demo_status = 'deployed', demo_deployed_at = NOW()
    WHERE id = $3 RETURNING *`,
    [demoUrl, deploymentId, id]
  );
  return rows[0];
}

/**
 * Updates a lead's outreach fields after email generation and/or sending.
 * @param id - Lead UUID
 * @param emailSubject - Email subject line
 * @param emailBody - Email body text
 * @param status - New outreach status
 */
export async function updateLeadOutreach(
  id: string,
  emailSubject: string,
  emailBody: string,
  status: OutreachStatus = 'queued'
): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET
      email_subject = $1, email_body = $2, outreach_status = $3
    WHERE id = $4 RETURNING *`,
    [emailSubject, emailBody, status, id]
  );
  return rows[0];
}

/**
 * Marks a lead's email as sent.
 * @param id - Lead UUID
 */
export async function markEmailSent(id: string): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET outreach_status = 'sent', email_sent_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

/**
 * Records a follow-up send for a lead.
 * @param id - Lead UUID
 */
export async function recordFollowUp(id: string): Promise<Lead> {
  const rows = await query<Lead>(
    `UPDATE leads SET
      follow_up_count = follow_up_count + 1,
      last_follow_up_at = NOW()
    WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

/**
 * Creates a new campaign.
 * @param data - Campaign creation data
 */
export async function createCampaign(data: {
  name: string;
  niche: string;
  city: string;
}): Promise<Campaign> {
  const rows = await query<Campaign>(
    `INSERT INTO campaigns (name, niche, city) VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.niche, data.city]
  );
  return rows[0];
}

/**
 * Fetches all campaigns ordered by created_at desc.
 */
export async function getCampaigns(): Promise<Campaign[]> {
  return query<Campaign>('SELECT * FROM campaigns ORDER BY created_at DESC');
}

/**
 * Fetches a single campaign by ID.
 * @param id - Campaign UUID
 */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  const rows = await query<Campaign>('SELECT * FROM campaigns WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Increments a campaign counter.
 * @param campaignId - Campaign UUID
 * @param field - Counter field to increment
 */
export async function incrementCampaignCounter(
  campaignId: string,
  field: 'leads_count' | 'demos_generated' | 'emails_sent' | 'replies_received'
): Promise<void> {
  await query(
    `UPDATE campaigns SET ${field} = ${field} + 1 WHERE id = $1`,
    [campaignId]
  );
}

// ─── OUTREACH LOG ─────────────────────────────────────────────────────────────

/**
 * Logs an outreach event for a lead.
 * @param leadId - Lead UUID
 * @param eventType - The event type (sent, opened, etc.)
 * @param eventData - Optional event metadata
 */
export async function logOutreachEvent(
  leadId: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<OutreachLog> {
  const rows = await query<OutreachLog>(
    `INSERT INTO outreach_log (lead_id, event_type, event_data) VALUES ($1, $2, $3) RETURNING *`,
    [leadId, eventType, JSON.stringify(eventData ?? {})]
  );
  return rows[0];
}

/**
 * Gets outreach log entries for a specific lead.
 * @param leadId - Lead UUID
 */
export async function getOutreachLogForLead(leadId: string): Promise<OutreachLog[]> {
  return query<OutreachLog>(
    'SELECT * FROM outreach_log WHERE lead_id = $1 ORDER BY created_at ASC',
    [leadId]
  );
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

/**
 * Returns aggregated stats for the dashboard overview.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const rows = await query<{
    total_leads: string;
    demos_generated: string;
    emails_sent: string;
    replied: string;
    avg_score: string;
    leads_this_week: string;
  }>(`
    SELECT
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE demo_status = 'deployed') as demos_generated,
      COUNT(*) FILTER (WHERE outreach_status IN ('sent', 'opened', 'replied', 'booked')) as emails_sent,
      COUNT(*) FILTER (WHERE outreach_status IN ('replied', 'booked')) as replied,
      ROUND(AVG(opportunity_score), 1) as avg_score,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as leads_this_week
    FROM leads
  `);

  const r = rows[0];
  const emailsSent = parseInt(r.emails_sent ?? '0', 10);
  const replied = parseInt(r.replied ?? '0', 10);

  return {
    total_leads: parseInt(r.total_leads ?? '0', 10),
    demos_generated: parseInt(r.demos_generated ?? '0', 10),
    emails_sent: emailsSent,
    reply_rate: emailsSent > 0 ? Math.round((replied / emailsSent) * 100) : 0,
    avg_opportunity_score: parseFloat(r.avg_score ?? '0'),
    leads_this_week: parseInt(r.leads_this_week ?? '0', 10),
  };
}
