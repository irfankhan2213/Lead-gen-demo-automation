/**
 * @file Token-bucket rate limiter for LLM provider API calls.
 * Tracks RPM per provider and sleeps when the limit is about to be exceeded.
 */

import logger from './logger.js';

interface BucketConfig {
  rpm: number;         // Max requests per minute
  tokens: number;      // Current available tokens
  lastRefill: number;  // Timestamp of last refill
}

const configs: Record<string, BucketConfig> = {};

function getConfig(provider: string): BucketConfig {
  if (!configs[provider]) {
    const rpm = parseInt(process.env[`${provider.toUpperCase()}_RPM`] || '0', 10)
      || defaultRPM(provider);

    configs[provider] = {
      rpm,
      tokens: rpm,
      lastRefill: Date.now(),
    };
  }
  return configs[provider];
}

function defaultRPM(provider: string): number {
  switch (provider) {
    case 'openai': return 1000;  // AICredits: 1000 RPM
    case 'groq': return 25;      // Groq free tier: ~30 RPM, use 25 for safety
    case 'gemini': return 12;    // Gemini free tier: ~15 RPM, use 12 for safety
    case 'anthropic': return 50; // Anthropic Tier-1: 50 RPM
    default: return 30;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Acquire a rate-limit slot for the given provider.
 * Will sleep if the bucket is empty until the next refill window.
 */
export async function acquire(provider: string): Promise<void> {
  const cfg = getConfig(provider);
  const now = Date.now();
  const elapsed = now - cfg.lastRefill;

  // Refill tokens based on elapsed time (proportional refill every 60s)
  if (elapsed >= 60_000) {
    cfg.tokens = cfg.rpm;
    cfg.lastRefill = now;
  } else {
    // Partial refill
    const refillRate = cfg.rpm / 60_000; // tokens per ms
    const refill = Math.floor(elapsed * refillRate);
    if (refill > 0) {
      cfg.tokens = Math.min(cfg.rpm, cfg.tokens + refill);
      cfg.lastRefill = now;
    }
  }

  if (cfg.tokens > 0) {
    cfg.tokens -= 1;
    return;
  }

  // Bucket empty — calculate wait time until next slot
  const msPerToken = Math.ceil(60_000 / cfg.rpm);
  logger.warn(`[RateLimiter] ${provider} RPM limit reached. Waiting ${msPerToken}ms...`);
  await sleep(msPerToken);

  // After wait, consume a token
  cfg.tokens = Math.max(0, cfg.tokens - 1);
}
