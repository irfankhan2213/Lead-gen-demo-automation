import { discoverBusinesses } from './services/scraper/discovery.js';

async function test() {
  console.log('Testing Organic Discovery...');
  for await (const b of discoverBusinesses('Growing AI and B2B SaaS startups', 'London, UK', 3)) {
    console.log('Organic Result:', b);
  }

  console.log('\\nTesting Local Discovery...');
  for await (const b of discoverBusinesses('Plumber', 'Austin TX', 3)) {
    console.log('Local Result:', b);
  }
}

test().catch(console.error);
