import pkg from 'pg';
const { Client } = pkg;
import * as dotenv from 'dotenv';

// Try to load .env from current directory (useful for local execution)
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS demo_mode VARCHAR(50) DEFAULT 'template';`);
    console.log('Successfully added demo_mode to campaigns table.');
    
    await client.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS job_id VARCHAR(255);`);
    console.log('Successfully added job_id to campaigns table.');
    
    // Also ensure leads has demo_mode if it was added there too
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS demo_mode VARCHAR(50) DEFAULT 'template';`);
    console.log('Successfully added demo_mode to leads table.');

    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS design_language VARCHAR(50) DEFAULT 'corporate';`);
    console.log('Successfully added design_language to leads table.');

    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_url TEXT;`);
    console.log('Successfully added logo_url to leads table.');

    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS scraped_images JSONB;`);
    console.log('Successfully added scraped_images to leads table.');

    // Add unique constraint for ON CONFLICT (business_name, city)
    await client.query(`ALTER TABLE leads ADD CONSTRAINT leads_business_city_unique UNIQUE (business_name, city);`).catch(e => {
      if (!e.message.includes('already exists')) {
        console.error('Failed to add unique constraint:', e.message);
      } else {
        console.log('Unique constraint leads_business_city_unique already exists.');
      }
    });
    console.log('Successfully ensured unique constraint on leads(business_name, city).');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
