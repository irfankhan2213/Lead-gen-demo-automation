/**
 * @file Follow-up sequence scheduler.
 * Manages the 4-touch outreach sequence for each lead:
 *   Day 0:  First email (demo reveal)
 *   Day 3:  Follow-up 1 — "Did you get a chance to see the site?"
 *   Day 7:  Follow-up 2 — add social proof
 *   Day 14: Final follow-up — breakup email
 *
 * Uses BullMQ delayed jobs for scheduling.
 */

import logger from '../../lib/logger.js';
import { outreachQueue } from '../../lib/queue.js';
import { getLeadById } from '../../db/queries.js';
import type { OutreachJobData } from '@acquisition-engine/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Follow-up schedule: [followUpNumber, delayDays] */
const FOLLOW_UP_SCHEDULE: [1 | 2 | 3, number][] = [
  [1, 3],   // Follow-up 1: Day 3
  [2, 7],   // Follow-up 2: Day 7
  [3, 14],  // Final: Day 14
];

/**
 * Schedules all follow-up emails for a lead after the initial email is sent.
 * Uses BullMQ delayed jobs so they fire at the right time automatically.
 *
 * @param leadId - Lead UUID
 * @param jobId - Parent job ID for SSE tracking
 */
export async function scheduleFollowUpSequence(leadId: string, jobId: string): Promise<void> {
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);
  if (!lead.email) {
    logger.warn(`No email for lead ${leadId}, skipping follow-up schedule`);
    return;
  }

  for (const [followUpNumber, delayDays] of FOLLOW_UP_SCHEDULE) {
    const delayMs = delayDays * DAY_MS;
    const jobData: OutreachJobData = {
      jobId: `${jobId}-followup-${followUpNumber}`,
      leadId,
      isFollowUp: true,
      followUpNumber,
    };

    await outreachQueue.add(`followup-${followUpNumber}` as any, jobData, {
      delay: delayMs,
      jobId: `${leadId}-followup-${followUpNumber}`,
      // Don't duplicate if already scheduled
      removeOnComplete: true,
    });

    logger.info(`Scheduled follow-up ${followUpNumber} for ${lead.business_name}`, {
      delayDays,
      sendAt: new Date(Date.now() + delayMs).toISOString(),
    });
  }
}

/**
 * Cancels all pending follow-up jobs for a lead.
 * Called when a lead replies or books a call.
 *
 * @param leadId - Lead UUID
 */
export async function cancelFollowUpSequence(leadId: string): Promise<void> {
  for (const [followUpNumber] of FOLLOW_UP_SCHEDULE) {
    const jobId = `${leadId}-followup-${followUpNumber}`;
    try {
      const job = await outreachQueue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info(`Cancelled follow-up job: ${jobId}`);
      }
    } catch (err) {
      logger.warn(`Could not cancel job ${jobId}`, { error: (err as Error).message });
    }
  }
}
