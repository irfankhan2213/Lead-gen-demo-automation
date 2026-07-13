import pkg from 'pg';
const { Client } = pkg;
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
