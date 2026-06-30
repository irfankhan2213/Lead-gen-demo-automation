/**
 * @file Database migration runner.
 * Automatically checks if the acquisition_engine database exists, creates it if not,
 * and runs schema.sql against it to initialize all tables and indexes.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const schemaPath = join(process.cwd(), 'apps/api/src/db/schema.sql');
const schemaSql = readFileSync(schemaPath, 'utf-8');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in environment!');
    process.exit(1);
  }

  // We connect to the default 'postgres' database to ensure 'acquisition_engine' exists
  const rootConnectionString = connectionString.replace(/\/acquisition_engine(\?.*)?$/, '/postgres$1');
  const rootClient = new Client({ connectionString: rootConnectionString });

  try {
    await rootClient.connect();
    console.log('📡 Connected to default postgres database...');

    const dbCheck = await rootClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'acquisition_engine'"
    );

    if (dbCheck.rows.length === 0) {
      console.log('🧱 Creating database: acquisition_engine...');
      await rootClient.query('CREATE DATABASE acquisition_engine');
      console.log('✅ Database acquisition_engine created.');
    } else {
      console.log('✅ Database acquisition_engine already exists.');
    }
  } catch (err) {
    console.warn('⚠️ Warning checking/creating database (trying direct schema application):', (err as Error).message);
  } finally {
    await rootClient.end();
  }

  // Connect to acquisition_engine and apply tables/indexes
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('🚀 Connecting to acquisition_engine. Applying schema...');
    await client.query(schemaSql);
    console.log('🎉 Schema migration applied successfully!');
  } catch (err) {
    console.error('❌ Error applying schema:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
export {};
