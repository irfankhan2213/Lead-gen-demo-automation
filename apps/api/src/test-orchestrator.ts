import { scrapeFullBusinessProfile } from './services/scraper/index.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function run() {
  console.log('Testing full orchestrator...');
  try {
    await scrapeFullBusinessProfile({
      jobId: 'test-job-123',
      niche: 'gym',
      city: 'Austin TX',
      limit: 2,
      campaignId: undefined
    } as any);
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
