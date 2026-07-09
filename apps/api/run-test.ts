import { scrapeFullBusinessProfile } from './src/services/scraper/index.js';
import { createCampaign, pool } from './src/db/queries.js';
import { v4 as uuid } from 'uuid';

async function run() {
  console.log('Starting End-to-End Test Campaign...');
  
  // 1. Create a Campaign
  const campaign = await createCampaign({
    name: 'Test Roofers in Austin',
    niche: 'Roofing Contractor',
    city: 'Austin, TX'
  });
  console.log(`✅ Campaign created: ${campaign.id}`);

  // 2. Scrape Leads
  const jobId = uuid();
  console.log(`🔍 Starting scraper... (this will take a minute)`);
  await scrapeFullBusinessProfile({
    jobId,
    niche: 'Roofing Contractor',
    city: 'Austin, TX',
    campaignId: campaign.id
  });

  console.log(`✅ Scraper finished.`);
  console.log('Check the dashboard! Make sure the API server and workers are running to process demos and outreach.');
  
  await pool.end();
  process.exit(0);
}

run().catch(console.error);
