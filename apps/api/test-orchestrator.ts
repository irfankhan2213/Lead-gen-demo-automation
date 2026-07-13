import { scrapeFullBusinessProfile } from './src/services/scraper/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await scrapeFullBusinessProfile({
    jobId: 'test-job',
    niche: 'pizza',
    city: 'San Francisco',
    limit: 2,
    demo_mode: 'template'
  });
  console.log('Test done');
  process.exit(0);
}

run();
