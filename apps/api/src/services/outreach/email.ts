/**
 * @file Resend.com email sending integration.
 * Handles all transactional email operations:
 *  - Sending cold outreach emails
 *  - Tracking open/click webhooks
 *  - Follow-up sequences
 *
 * Rate limit: Resend free tier = 3000 emails/month (100/day)
 * @see https://resend.com/docs
 */

import { Resend } from 'resend';
import logger from '../../lib/logger.js';
import { markEmailSent, logOutreachEvent, updateLeadOutreach } from '../../db/queries.js';
import { writeEmail, writeFollowUpEmail } from '../ai/writeEmail.js';
import type { Lead, GeneratedEmail } from '@acquisition-engine/shared';

let resendClient: Resend | null = null;

/** Lazy-initializes the Resend client */
function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not set in environment');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Sends a cold outreach email to a lead.
 * Generates email copy via Claude, saves to DB, then sends via Resend.
 *
 * @param lead - Full lead data
 * @param demoUrl - Live demo URL to include in the email
 * @param sendImmediately - Whether to send now or just save as queued
 * @returns Email ID from Resend (if sent) or null
 */
export async function sendOutreachEmail(
  lead: Lead,
  demoUrl: string,
  sendImmediately = false
): Promise<string | null> {
  if (!lead.email) {
    logger.warn(`Cannot send email to ${lead.business_name}: no email address`);
    return null;
  }

  // Generate email copy via Claude
  let email: GeneratedEmail;
  try {
    email = await writeEmail(lead, demoUrl);
  } catch (err) {
    logger.error('Failed to generate email copy', { error: (err as Error).message });
    throw err;
  }

  // Save email content to DB
  await updateLeadOutreach(lead.id, email.subject, email.body, 'queued');
  logger.info(`Email queued for ${lead.business_name}: "${email.subject}"`);

  if (!sendImmediately) {
    return null; // Just queued, not sent
  }

  // Send via Resend
  return sendEmailNow(lead.id, lead.email, email.subject, email.body, lead.business_name);
}

/**
 * Sends an already-generated email using Resend.
 * Used both for initial sends and follow-ups.
 *
 * @param leadId - Lead UUID for logging
 * @param toEmail - Recipient email address
 * @param subject - Email subject line
 * @param body - Plain text body (converted to HTML)
 * @param businessName - For logging
 * @returns Resend email ID
 */
export async function sendEmailNow(
  leadId: string,
  toEmail: string,
  subject: string,
  body: string,
  businessName?: string
): Promise<string> {
  const resend = getResend();
  const fromEmail = process.env.FROM_EMAIL ?? 'hello@evolveexpert.agency';
  const fromName = process.env.FROM_NAME ?? 'Evolve Expert Agency';

  // Convert plain text to simple HTML
  const htmlBody = body
    .split('\n')
    .map((line) => (line.trim() ? `<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1a1a1a">${line}</p>` : '<br/>'))
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="background:#fff;padding:40px 20px;max-width:560px;margin:0 auto">
<div style="font-family:Georgia,serif">
${htmlBody}
</div>
<div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e5e5;font-size:12px;color:#999">
  <p style="margin:0">This email was sent via Evolve Expert Agency. <a href="#" style="color:#999">Unsubscribe</a></p>
</div>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [toEmail],
    subject,
    html,
    text: body,
    tags: [{ name: 'lead_id', value: leadId }],
  });

  if (error) {
    logger.error('Resend send error', { error, leadId, toEmail });
    throw new Error(`Resend error: ${error.message}`);
  }

  const emailId = data?.id ?? 'unknown';
  logger.info(`Email sent to ${toEmail}`, { emailId, subject });

  // Update DB and log event
  await markEmailSent(leadId);
  await logOutreachEvent(leadId, 'sent', { email_id: emailId, to: toEmail, subject });

  return emailId;
}

/**
 * Sends a follow-up email to a lead.
 *
 * @param lead - Full lead data
 * @param followUpNumber - Which follow-up (1, 2, or 3)
 * @returns Resend email ID or null
 */
export async function sendFollowUpEmail(
  lead: Lead,
  followUpNumber: 1 | 2 | 3
): Promise<string | null> {
  if (!lead.email || !lead.demo_url) {
    logger.warn(`Cannot send follow-up to ${lead.business_name}: missing email or demo URL`);
    return null;
  }

  const email = await writeFollowUpEmail(lead, lead.demo_url, followUpNumber);
  return sendEmailNow(lead.id, lead.email, email.subject, email.body, lead.business_name);
}
