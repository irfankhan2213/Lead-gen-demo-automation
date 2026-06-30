/**
 * @file Supabase client helpers for the Acquisition Engine API.
 *
 * Provides two clients:
 *  - `supabaseAdmin`  — service-role client, bypasses RLS (server-side only)
 *  - `createUserClient` — RLS-scoped client for an authenticated user request
 *
 * For Edge Function / Cloudflare Worker style handlers, use `withSupabase`
 * from "@supabase/server" directly. For Express routes, use these helpers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL env var');
if (!SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing SUPABASE_PUBLISHABLE_KEY env var');

// ─── Admin client (bypasses RLS) ──────────────────────────────────────────────
// Use this for background workers, admin operations, and internal API routes.
// NEVER expose this to the browser or unauthenticated callers.
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ─── User-scoped client (respects RLS) ───────────────────────────────────────
// Pass the user's JWT from the Authorization header to scope queries to that user.
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── Express middleware helper ────────────────────────────────────────────────
// Mimics the @supabase/server `withSupabase` pattern for Express routes.
// Usage:
//   router.get('/protected', requireAuth, async (req, res) => {
//     const client = createUserClient(req.supabaseToken!);
//     const { data } = await client.from('leads').select();
//   });
import { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabaseToken?: string;
    }
  }
}

/**
 * Express middleware that validates a Supabase JWT from the Authorization header.
 * Sets `req.supabaseToken` on success; returns 401 on failure.
 * Auth mode: "user" (equivalent to withSupabase({ auth: "user" }))
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // Verify token by calling Supabase auth
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.supabaseToken = token;
  next();
}

/**
 * Express middleware for publishable-key auth (no JWT required).
 * Auth mode: "publishable" (equivalent to withSupabase({ auth: "publishable" }))
 */
export function publishableAuth(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Publishable key routes are public — just continue
  next();
}
