/**
 * @file Server-Sent Events (SSE) manager.
 * Allows the API backend to stream real-time log messages to the Next.js dashboard.
 * Workers emit events via sseEmit(); the frontend subscribes via GET /api/events.
 */

import { Response } from 'express';
import { SSEEvent } from '@acquisition-engine/shared';

// ─── SSE Client Registry ──────────────────────────────────────────────────────

/** Map of jobId → set of connected SSE response streams */
const clients = new Map<string, Set<Response>>();

/** Global broadcast channel — all events go here too */
const globalClients = new Set<Response>();

// ─── Register / Unregister ────────────────────────────────────────────────────

/**
 * Registers an Express response as an SSE stream.
 * @param res - The Express response object to keep open
 * @param jobId - Optional job ID to subscribe to a specific job's events
 */
export function registerSSEClient(res: Response, jobId?: string): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  if (jobId) {
    if (!clients.has(jobId)) clients.set(jobId, new Set());
    clients.get(jobId)!.add(res);
  } else {
    globalClients.add(res);
  }

  // 30-second heartbeat to keep connection alive and detect dead clients
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch {
      // Client is dead — clean up
      clearInterval(heartbeat);
      if (jobId) clients.get(jobId)?.delete(res);
      else globalClients.delete(res);
    }
  }, 30_000);

  // Clean up on disconnect
  res.on('close', () => {
    clearInterval(heartbeat);
    if (jobId) clients.get(jobId)?.delete(res);
    else globalClients.delete(res);
  });
}

// ─── Emit Events ─────────────────────────────────────────────────────────────

/**
 * Emits an SSE event to all subscribers of a given jobId and global clients.
 * @param event - The SSE event to broadcast
 */
export function sseEmit(event: SSEEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;

  // Send to job-specific subscribers
  clients.get(event.jobId)?.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      clients.get(event.jobId)?.delete(res);
    }
  });

  // Send to global subscribers (dashboard live log)
  globalClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      globalClients.delete(res);
    }
  });
}

/**
 * Creates a scoped logger that emits SSE events for a specific job.
 * Used by all workers to stream progress to the dashboard.
 *
 * @param jobId - The job identifier
 * @returns An object with log, success, warn, and error methods
 */
export function createSSELogger(jobId: string) {
  const emit = (level: SSEEvent['level'], message: string, data?: Record<string, unknown>) => {
    sseEmit({
      jobId,
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  };

  return {
    log: (message: string, data?: Record<string, unknown>) => emit('info', message, data),
    success: (message: string, data?: Record<string, unknown>) => emit('success', message, data),
    warn: (message: string, data?: Record<string, unknown>) => emit('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) => emit('error', message, data),
  };
}
