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

import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiKey = process.env.GEMINI_API_KEY;

export async function callLLM(prompt: string, maxTokens = 1024, jsonMode = false): Promise<string> {
  // 1. Try Gemini First
  if (geminiKey) {
    logger.info('Calling LLM via Gemini API...');
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const generationConfig: any = { maxOutputTokens: maxTokens, temperature: 0.2 };
      if (jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });
      const content = result.response.text();
      if (content) return content;
    } catch (err) {
      logger.error('Gemini LLM call failed. Falling back...', { error: (err as Error).message });
    }
  }

  // 2. Try Groq Second
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
        const bodyPayload: any = {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        };
        if (jsonMode) {
          bodyPayload.response_format = { type: "json_object" };
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveGroqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });

        if (response.status === 429) {
          logger.warn(`Groq model ${model} rate limited (429). Trying fallback...`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AI service returned an unexpected response: ${response.status} ${errorText}`);
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
  }

  // 3. Fallback to Anthropic Claude
  if (effectiveAnthropicKey) {
    logger.info('Calling LLM via Anthropic API...');
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
    }
  }

  throw new Error('AI service configuration is incomplete or all models failed. Please check the API keys.');
}
