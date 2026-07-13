import { getCampaigns } from './src/db/queries.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const c = await getCampaigns();
  console.log('Campaigns:', c);
  process.exit(0);
}

run();
