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
    const { jobId, leadId } = job.data;
    const log = createSSELogger(jobId);

    logger.info(`[GenerateWorker] Processing job ${job.id} for lead ${leadId}`);

    // Fetch lead from DB
    const lead = await getLeadById(leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    log.log(`🎨 Building demo site for ${lead.business_name}...`);

    // Generate HTML
    const html = await buildDemoSite(lead);
    await updateLeadDemo(leadId, html, 'ready');
    log.success(`✅ Demo HTML generated (${Math.round(html.length / 1024)}KB)`);

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

worker.on('failed', (job, err) => {
  logger.error(`[GenerateWorker] ❌ Job ${job?.id} failed`, { error: err.message });
});

worker.on('error', (err) => {
  logger.error('[GenerateWorker] Worker error', { error: err.message });
});

logger.info('[GenerateWorker] Started, waiting for jobs...');

export default worker;
