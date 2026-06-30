/**
 * @file BullMQ outreach worker.
 * Processes jobs from the 'outreach' queue.
 * Handles both initial outreach emails and follow-up sequence emails.
 */

import { Worker, Job } from 'bullmq';
import logger from '../lib/logger.js';
import { redisConnection } from '../lib/queue.js';
import { createSSELogger } from '../lib/sse.js';
import { getLeadById, recordFollowUp, incrementCampaignCounter } from '../db/queries.js';
import { sendEmailNow, sendFollowUpEmail } from '../services/outreach/email.js';
import { scheduleFollowUpSequence } from '../services/outreach/sequences.js';
import type { OutreachJobData } from '@acquisition-engine/shared';

const worker = new Worker<OutreachJobData>(
  'outreach',
  async (job: Job<OutreachJobData>) => {
    const { jobId, leadId, isFollowUp, followUpNumber } = job.data;
    const log = createSSELogger(jobId);

    const lead = await getLeadById(leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    // Skip if lead has replied or booked — don't send more emails
    if (['replied', 'booked', 'lost'].includes(lead.outreach_status)) {
      logger.info(`[OutreachWorker] Skipping ${lead.business_name} — status: ${lead.outreach_status}`);
      return;
    }

    if (isFollowUp && followUpNumber) {
      // Send a follow-up email
      log.log(`📬 Sending follow-up #${followUpNumber} to ${lead.business_name}...`);
      const emailId = await sendFollowUpEmail(lead, followUpNumber as 1 | 2 | 3);
      await recordFollowUp(leadId);
      log.success(`✉️ Follow-up #${followUpNumber} sent to ${lead.email}`, { emailId });
    } else {
      // Send initial outreach email
      if (!lead.email_subject || !lead.email_body) {
        throw new Error(`Lead ${leadId} has no email content — generate email first`);
      }

      log.log(`✉️ Sending outreach to ${lead.business_name} at ${lead.email}...`);
      const emailId = await sendEmailNow(
        lead.id,
        lead.email!,
        lead.email_subject,
        lead.email_body,
        lead.business_name
      );
      log.success(`📨 Email sent!`, { emailId, to: lead.email });

      // Update campaign counter
      if (lead.campaign_id) {
        await incrementCampaignCounter(lead.campaign_id, 'emails_sent').catch(() => {});
      }

      // Schedule follow-up sequence
      await scheduleFollowUpSequence(leadId, jobId);
      log.log(`📅 Follow-up sequence scheduled (Day 3, 7, 14)`);
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 5, // Can send 5 emails in parallel
    limiter: {
      max: 50,
      duration: 60_000, // Max 50 emails per minute
    },
  }
);

worker.on('completed', (job) => {
  logger.info(`[OutreachWorker] ✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`[OutreachWorker] ❌ Job ${job?.id} failed`, { error: err.message });
});

logger.info('[OutreachWorker] Started, waiting for jobs...');

export default worker;
