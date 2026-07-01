/**
 * @file Unified LLM client wrapper supporting both Anthropic (Claude) and Groq.
 * Automatically switches to Groq if a Groq API key is present or if the key starts with 'gsk_'.
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from '../../lib/logger.js';

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

// Detect if Groq key is used (either via GROQ_API_KEY or if ANTHROPIC_API_KEY has 'gsk_' prefix)
const effectiveGroqKey = groqKey || (anthropicKey?.startsWith('gsk_') ? anthropicKey : undefined);
const effectiveAnthropicKey = anthropicKey?.startsWith('gsk_') ? undefined : anthropicKey;

/**
 * Sends a prompt to the configured LLM provider (Groq or Anthropic).
 *
 * @param prompt - The input prompt text
 * @param maxTokens - Maximum response tokens (default 1024)
 * @returns Response text content
 */
export async function callLLM(prompt: string, maxTokens = 1024): Promise<string> {
  if (effectiveGroqKey) {
    const models = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it'
    ];

    let lastError: Error | null = null;

    for (const model of models) {
      logger.info(`Calling LLM via Groq API (model: ${model})...`);
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveGroqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
        });

        if (response.status === 429) {
          logger.warn(`Groq model ${model} rate limited (429). Trying fallback...`);
          continue;
        }

        if (!response.ok) {
          throw new Error('AI service returned an unexpected response. Please try again.');
        }

        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Groq API response did not contain content choices');
        }

        return content;
      } catch (err) {
        logger.error(`Groq LLM call failed for model ${model}`, { error: (err as Error).message });
        lastError = err as Error;
      }
    }

    throw lastError || new Error('The AI assistant is temporarily busy. Please try again shortly.');
  }

  // Fallback to Anthropic Claude
  logger.info('Calling LLM via Anthropic API...');
    throw new Error('AI service configuration is incomplete. Please set the required API keys.');

  try {
    const anthropic = new Anthropic({ apiKey: effectiveAnthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? (content as any).text : '';
  } catch (err) {
    logger.error('Anthropic LLM call failed', { error: (err as Error).message });
    throw err;
  }
}
