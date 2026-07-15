/**
 * @file BullMQ demo generation worker.
 * Processes jobs from the 'generate' queue.
 * For each job: fetches the lead, builds the HTML demo, deploys to Vercel,
 * and updates the lead record with the live URL.
 */

import { Worker, Job } from 'bullmq';
import logger from '../lib/logger.js';
import { redisConnection } from '../lib/queue.js';
import { createSSELogger } from '../lib/sse.js';
import { getLeadById, updateLeadDemo, updateLeadDeployment, incrementCampaignCounter } from '../db/queries.js';
import { buildDemoSite } from '../services/demo/builder.js';
import { deployDemoToVercel } from '../services/hosting/vercel.js';
import type { GenerateJobData } from '@acquisition-engine/shared';

const worker = new Worker<GenerateJobData>(
  'generate',
  async (job: Job<GenerateJobData>) => {
    const { jobId, leadId, demo_mode } = job.data;
    const log = createSSELogger(jobId);

    logger.info(`[GenerateWorker] Processing job ${job.id} for lead ${leadId}`);

    // Fetch lead from DB
    const lead = await getLeadById(leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    // Generate HTML — prefer demo_mode from job data over DB value
    const effectiveDemoMode = demo_mode ?? lead.demo_mode ?? 'ai_scratch';
    log.log(`🎨 Building demo site for ${lead.business_name} (mode: ${effectiveDemoMode})...`);
    const leadWithMode = { ...lead, demo_mode: effectiveDemoMode } as typeof lead;
    const html = await buildDemoSite(leadWithMode);
    await updateLeadDemo(leadId, html, 'ready');
    const htmlSizeKb = Math.round(html.length / 1024);
    const lineCount = html.split('\n').length;
    log.success(`✅ Demo HTML generated (${htmlSizeKb}KB, ${lineCount} lines)`);

    // Quality gate — warn if output is suspiciously small
    if (html.length < 10_000) {
      logger.warn(`[GenerateWorker] ⚠️ LOW QUALITY output for lead ${leadId}: only ${htmlSizeKb}KB / ${lineCount} lines — may be truncated`);
      log.warn(`⚠️ Demo HTML seems small (${htmlSizeKb}KB). If it looks incomplete, try regenerating.`);
    }

    // Deploy to Vercel
    log.log(`🚀 Deploying to Vercel...`);
    const { demoUrl, deploymentId } = await deployDemoToVercel(
      leadId,
      lead.business_name ?? 'business',
      html
    );

    // Save deployment info
    await updateLeadDeployment(leadId, demoUrl, deploymentId);
    log.success(`🌐 Live at: ${demoUrl}`, { demoUrl, deploymentId });

    // Auto-generate Email
    log.log(`✍️ Generating AI email copy...`);
    try {
      const { writeEmail } = await import('../services/ai/writeEmail.js');
      const { updateLeadOutreach } = await import('../db/queries.js');
      const email = await writeEmail(lead, demoUrl);
      await updateLeadOutreach(leadId, email.subject, email.body, 'queued');
      log.success(`✉️ Email generated and queued`);
    } catch (emailErr) {
      log.warn(`⚠️ Failed to generate email: ${(emailErr as Error).message}`);
    }

    // Update campaign counter
    if (lead.campaign_id) {
      await incrementCampaignCounter(lead.campaign_id, 'demos_generated').catch(() => {});
    }

    logger.info(`[GenerateWorker] ✅ Demo deployed: ${demoUrl}`);
  },
  {
    connection: redisConnection as any,
    concurrency: 2, // Can generate 2 demos in parallel
  }
);

worker.on('completed', (job) => {
  logger.info(`[GenerateWorker] ✅ Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
  logger.error(`[GenerateWorker] ❌ Job ${job?.id} failed`, { error: err.message });
  // Mark lead as failed so user can retry from the UI
  if (job?.data?.leadId) {
    try {
      const { updateLeadDemo } = await import('../db/queries.js');
      await updateLeadDemo(job.data.leadId, '', 'failed');
    } catch { /* ignore secondary failure */ }
  }
});

worker.on('error', (err) => {
  logger.error('[GenerateWorker] Worker error', { error: err.message });
});

logger.info('[GenerateWorker] Started, waiting for jobs...');

export default worker;
