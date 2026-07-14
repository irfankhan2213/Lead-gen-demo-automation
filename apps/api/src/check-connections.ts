import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import Redis from 'ioredis';

async function checkPostgres() {
  console.log('--- Testing PostgreSQL (Supabase) connection... ---');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not defined in .env');
    return false;
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('PostgreSQL Success! Database time:', res.rows[0].now);
    await client.end();
    return true;
  } catch (err) {
    console.error('PostgreSQL Connection Failed:', (err as Error).message);
    return false;
  }
}

async function checkRedis() {
  console.log('--- Testing Redis connection... ---');
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`Using REDIS_URL: ${url}`);
  const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const ping = await redis.ping();
    console.log('Redis Success! Ping response:', ping);
    await redis.quit();
    return true;
  } catch (err) {
    console.error('Redis Connection Failed:', (err as Error).message);
    return false;
  }
}

async function checkVercel() {
  console.log('--- Testing Vercel Token... ---');
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error('VERCEL_TOKEN is not defined in .env');
    return false;
  }
  try {
    const res = await fetch('https://api.vercel.com/v2/projects', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      console.log('Vercel API Success! Token is valid.');
      return true;
    } else {
      console.error(`Vercel API Error: ${res.status} ${await res.text()}`);
      return false;
    }
  } catch (err) {
    console.error('Vercel API connection failed:', (err as Error).message);
    return false;
  }
}

async function main() {
  console.log('================ CONNECTION CHECKER ================');
  const pgOk = await checkPostgres();
  const redisOk = await checkRedis();
  const vercelOk = await checkVercel();
  console.log('====================================================');
  console.log('SUMMARY:');
  console.log(`- Supabase Postgres: ${pgOk ? 'CONNECTED' : 'FAILED'}`);
  console.log(`- Redis Queue:      ${redisOk ? 'CONNECTED' : 'FAILED (Run: brew services start redis or redis-server)'}`);
  console.log(`- Vercel API:       ${vercelOk ? 'CONNECTED' : 'FAILED'}`);
}

main().catch(console.error);
