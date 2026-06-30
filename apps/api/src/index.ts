/**
 * @file Express server entry point for the Acquisition Engine API.
 * Bootstraps all middleware, routes, workers, and SSE endpoint.
 * Starts on PORT (default 3001).
 */

import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import logger from './lib/logger.js';
import { registerSSEClient } from './lib/sse.js';

// Routes
import leadsRouter from './routes/leads.js';
import scrapeRouter from './routes/scrape.js';
import generateRouter from './routes/generate.js';
import deployRouter from './routes/deploy.js';
import outreachRouter from './routes/outreach.js';

// Workers (start listening as soon as server boots)
import './workers/scrapeWorker.js';
import './workers/generateWorker.js';
import './workers/outreachWorker.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Trust proxy (for Railway/Heroku deployments) ─────────────────────────────
app.set('trust proxy', 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Allow demo previews in iframes
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like server-to-server, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      const isVercel = origin.endsWith('.vercel.app');
      const isCustomDashboard = process.env.DASHBOARD_URL ? origin === process.env.DASHBOARD_URL : false;

      if (isLocal || isVercel || isCustomDashboard) {
        callback(null, true);
      } else {
        logger.warn(`Blocked by CORS: ${origin}`);
        callback(null, false); // Block origin but don't crash Express
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === '/health', // Don't log health checks
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' })); // Large enough for HTML demos
app.use(express.urlencoded({ extended: true }));

// ─── Global Rate Limit ───────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

import { pool } from './db/queries.js';
app.get('/api/debug-db', async (_req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      time: result.rows[0].now,
      latencyMs: Date.now() - start,
      databaseUrlEnvExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length ?? 0
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: (err as Error).message,
      stack: (err as Error).stack,
      databaseUrlEnvExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length ?? 0
    });
  }
});

// ─── SSE — Real-time Event Stream ─────────────────────────────────────────────
/**
 * GET /api/events
 * Query params: ?jobId=xxx (optional — subscribe to a specific job)
 * Streams Server-Sent Events to the dashboard for real-time updates.
 */
app.get('/api/events', (req, res) => {
  const jobId = req.query.jobId as string | undefined;
  registerSSEClient(res, jobId);
  logger.info(`SSE client connected`, { jobId: jobId ?? 'global' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/leads', leadsRouter);
app.use('/api/scrape', scrapeRouter);
app.use('/api/generate-demo', generateRouter);
app.use('/api/deploy', deployRouter);
app.use('/api/outreach', outreachRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Acquisition Engine API running on http://localhost:${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`📡 SSE stream: http://localhost:${PORT}/api/events`);
});

export default app;
