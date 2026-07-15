/**
 * @file Unified LLM client wrapper.
 * Supports Gemini (direct), Groq, Anthropic, and OpenAI-compatible gateways (AICredits, OpenRouter).
 * Features:
 *  - Ordered provider fallback chain
 *  - Exponential backoff retry on 429 rate limits
 *  - Per-provider RPM token-bucket throttling
 *  - Per-call 30s timeout guard
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../lib/logger.js';
import { acquire } from '../../lib/rateLimiter.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Parse the number of milliseconds to wait from a 429 Retry-After header or fallback.
 */
function parseRetryAfter(headers: Headers, attempt: number): number {
  const retryAfter = headers.get('retry-after') || headers.get('x-ratelimit-reset-requests');
  if (retryAfter) {
    const seconds = parseFloat(retryAfter);
    if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
  }
  // Exponential backoff: 2s, 4s, 8s
  return Math.min(2000 * Math.pow(2, attempt), 30_000);
}

// ─── Main callLLM ─────────────────────────────────────────────────────────────

export async function callLLM(
  prompt: string,
  maxTokens = 1024,
  jsonMode = false,
  preferredProvider?: 'gemini' | 'groq' | 'anthropic' | 'openai'
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  // Use namespaced model ID (e.g. google/gemini-3.5-flash for AICredits)
  const openaiModel = jsonMode
    ? (process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_MODEL || 'google/gemini-3.5-flash')
    : (process.env.OPENAI_MODEL || 'google/gemini-3.5-flash');

  const effectiveGroqKey = groqKey || (anthropicKey?.startsWith('gsk_') ? anthropicKey : undefined);
  const effectiveAnthropicKey = anthropicKey?.startsWith('gsk_') ? undefined : anthropicKey;

  const defaultProvider = process.env.PREFERRED_LLM_PROVIDER || 'openai';
  const primaryProvider = preferredProvider || defaultProvider;

  const order: string[] = [];
  if (primaryProvider === 'groq') {
    order.push('groq', 'openai', 'gemini', 'anthropic');
  } else if (primaryProvider === 'anthropic') {
    order.push('anthropic', 'openai', 'gemini', 'groq');
  } else if (primaryProvider === 'openai') {
    order.push('openai', 'groq', 'gemini', 'anthropic');
  } else {
    order.push('gemini', 'openai', 'groq', 'anthropic');
  }

  const MAX_RETRIES = 3;

  for (const provider of Array.from(new Set(order))) {

    // ── 1. Gemini (Direct Google API) ────────────────────────────────────────
    if (provider === 'gemini' && geminiKey) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        await acquire('gemini');
        logger.info(`Calling LLM via Gemini API (attempt ${attempt + 1})...`);
        try {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
          const model = genAI.getGenerativeModel({ model: modelName });
          const generationConfig: any = { maxOutputTokens: maxTokens, temperature: 0.2 };
          if (jsonMode) generationConfig.responseMimeType = 'application/json';

          const result = await withTimeout(
            model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig,
            }),
            30_000,
            'Gemini'
          );

          const content = result.response.text();
          if (content) return content;
        } catch (err) {
          const msg = (err as Error).message;
          const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');
          logger.error(`Gemini LLM call failed (attempt ${attempt + 1})`, { error: msg });
          if (is429 && attempt < MAX_RETRIES - 1) {
            const wait = Math.min(2000 * Math.pow(2, attempt), 30_000);
            logger.warn(`Gemini rate limited. Waiting ${wait}ms before retry...`);
            await sleep(wait);
          } else {
            break; // Non-retriable error or max retries reached
          }
        }
      }
    }

    // ── 2. Groq ──────────────────────────────────────────────────────────────
    if (provider === 'groq' && effectiveGroqKey) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];

      for (const model of groqModels) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          await acquire('groq');
          logger.info(`Calling LLM via Groq (model: ${model}, attempt ${attempt + 1})...`);
          try {
            const bodyPayload: any = {
              model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: maxTokens,
              temperature: 0.2,
            };
            if (jsonMode) bodyPayload.response_format = { type: 'json_object' };

            const response = await withTimeout(
              fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${effectiveGroqKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload),
              }),
              30_000,
              `Groq/${model}`
            );

            if (response.status === 429) {
              const wait = parseRetryAfter(response.headers, attempt);
              logger.warn(`Groq ${model} rate limited (429). Waiting ${wait}ms...`);
              await sleep(wait);
              continue;
            }
            if (!response.ok) {
              throw new Error(`Groq ${response.status}: ${await response.text()}`);
            }

            const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
            throw new Error('Groq response missing content choices');
          } catch (err) {
            logger.error(`Groq call failed (model: ${model}, attempt ${attempt + 1})`, { error: (err as Error).message });
            if (attempt < MAX_RETRIES - 1) await sleep(2000 * Math.pow(2, attempt));
            else break;
          }
        }
      }
    }

    // ── 3. Anthropic ─────────────────────────────────────────────────────────
    if (provider === 'anthropic' && effectiveAnthropicKey) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        await acquire('anthropic');
        logger.info(`Calling LLM via Anthropic (attempt ${attempt + 1})...`);
        try {
          const client = new Anthropic({ apiKey: effectiveAnthropicKey });
          const response = await withTimeout(
            client.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: maxTokens,
              messages: [{ role: 'user', content: prompt }],
            }),
            30_000,
            'Anthropic'
          );
          const text = response.content[0].type === 'text' ? response.content[0].text : '';
          if (text) return text;
        } catch (err) {
          const msg = (err as Error).message;
          const is429 = msg.includes('429') || msg.includes('rate_limit');
          logger.error(`Anthropic call failed (attempt ${attempt + 1})`, { error: msg });
          if (is429 && attempt < MAX_RETRIES - 1) {
            const wait = Math.min(2000 * Math.pow(2, attempt), 30_000);
            logger.warn(`Anthropic rate limited. Waiting ${wait}ms...`);
            await sleep(wait);
          } else break;
        }
      }
    }

    // ── 4. OpenAI-Compatible (AICredits / OpenRouter) ────────────────────────
    if (provider === 'openai' && openaiKey) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        await acquire('openai');
        logger.info(`Calling LLM via AICredits (model: ${openaiModel}, attempt ${attempt + 1})...`);
        try {
          const bodyPayload: any = {
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.2,
          };
          if (jsonMode) bodyPayload.response_format = { type: 'json_object' };

          const response = await withTimeout(
            fetch(`${openaiBaseUrl}/chat/completions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload),
            }),
            60_000,  // Longer timeout for HTML generation
            `AICredits/${openaiModel}`
          );

          if (response.status === 429) {
            const wait = parseRetryAfter(response.headers, attempt);
            logger.warn(`AICredits rate limited (429). Waiting ${wait}ms...`);
            await sleep(wait);
            continue;
          }
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AICredits ${response.status}: ${errorText}`);
          }

          const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
          throw new Error(`AICredits response missing content choices: ${JSON.stringify(data)}`);
        } catch (err) {
          logger.error(`AICredits call failed (model: ${openaiModel}, attempt ${attempt + 1})`, { error: (err as Error).message });
          if (attempt < MAX_RETRIES - 1) await sleep(2000 * Math.pow(2, attempt));
          else break;
        }
      }
    }
  }

  throw new Error('All LLM providers failed. Check API keys, quotas, and network connectivity.');
}
