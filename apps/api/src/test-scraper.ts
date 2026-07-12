import { scrapeGoogleMaps } from './services/scraper/googleMaps.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function run() {
  console.log('Starting...');
  try {
    let count = 0;
    for await (const b of scrapeGoogleMaps('gym', 'Austin TX', 'unlimited')) {
      console.log(b.name);
      count++;
      if (count >= 5) break;
    }
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
}
run();
