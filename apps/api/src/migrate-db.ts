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
    
    // Also ensure leads has demo_mode if it was added there too
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS demo_mode VARCHAR(50) DEFAULT 'template';`);
    console.log('Successfully added demo_mode to leads table.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
