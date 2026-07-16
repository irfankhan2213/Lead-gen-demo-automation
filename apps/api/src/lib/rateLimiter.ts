/**
 * @file Pacing rate limiter for LLM provider API calls.
 * Ensures concurrent requests for the same provider are spaced out
 * to completely prevent concurrent thundering herds and 429 rate limits.
 */

import logger from './logger.js';

interface RateLimiterConfig {
  rpm: number;
  nextAllowedTime: number;
}

const configs: Record<string, RateLimiterConfig> = {};

function getConfig(provider: string): RateLimiterConfig {
  if (!configs[provider]) {
    const rpm = parseInt(process.env[`${provider.toUpperCase()}_RPM`] || '0', 10)
      || defaultRPM(provider);

    configs[provider] = {
      rpm,
      nextAllowedTime: Date.now(),
    };
  }
  return configs[provider];
}

function defaultRPM(provider: string): number {
  switch (provider.toLowerCase()) {
    case 'openai': return 600;   // AICredits: 600 RPM (1 request per 100ms)
    case 'groq': return 15;      // Groq free tier: 15 RPM (1 request per 4s)
    case 'gemini': return 12;    // Gemini free tier: 12 RPM (1 request per 5s)
    case 'anthropic': return 50; // Anthropic Tier-1: 50 RPM (1 request per 1.2s)
    default: return 30;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Acquire a rate-limit slot for the given provider.
 * Uses a strict spacing queue algorithm (runs atomically in the JS event loop thread)
 * to space out concurrent requests and completely avoid overlapping bursts.
 */
export async function acquire(provider: string): Promise<void> {
  const cfg = getConfig(provider);
  const now = Date.now();
  const interval = Math.ceil(60_000 / cfg.rpm);

  let waitTime = 0;

  // Since JS runs single-threaded, this block is synchronous and atomic.
  // We compute non-overlapping nextAllowedTime slots for concurrent requests.
  if (now < cfg.nextAllowedTime) {
    waitTime = cfg.nextAllowedTime - now;
    cfg.nextAllowedTime += interval;
  } else {
    cfg.nextAllowedTime = now + interval;
  }

  if (waitTime > 0) {
    logger.warn(`[RateLimiter] ${provider} pacing request. Sleeping ${waitTime}ms...`);
    await sleep(waitTime);
  }
}
