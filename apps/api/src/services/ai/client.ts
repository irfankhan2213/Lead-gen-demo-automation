/**
 * @file Unified LLM client wrapper supporting both Anthropic (Claude) and Groq.
 * Automatically switches to Groq if a Groq API key is present or if the key starts with 'gsk_'.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../lib/logger.js';

export async function callLLM(
  prompt: string,
  maxTokens = 1024,
  jsonMode = false,
  preferredProvider?: 'gemini' | 'groq' | 'anthropic'
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Detect if Groq key is used (either via GROQ_API_KEY or if ANTHROPIC_API_KEY has 'gsk_' prefix)
  const effectiveGroqKey = groqKey || (anthropicKey?.startsWith('gsk_') ? anthropicKey : undefined);
  const effectiveAnthropicKey = anthropicKey?.startsWith('gsk_') ? undefined : anthropicKey;

  const defaultProvider = process.env.PREFERRED_LLM_PROVIDER || 'gemini';
  const primaryProvider = preferredProvider || defaultProvider;

  // Create an ordered list of providers to try
  const order: string[] = [];
  if (primaryProvider === 'groq') {
    order.push('groq', 'gemini', 'anthropic');
  } else if (primaryProvider === 'anthropic') {
    order.push('anthropic', 'gemini', 'groq');
  } else {
    order.push('gemini', 'groq', 'anthropic');
  }

  const uniqueOrder = Array.from(new Set(order));

  for (const provider of uniqueOrder) {
    // 1. Try Gemini
    if (provider === 'gemini' && geminiKey) {
      logger.info('Calling LLM via Gemini API...');
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });
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

    // 2. Try Groq
    if (provider === 'groq' && effectiveGroqKey) {
      const models = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'gemma2-9b-it'
      ];

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
        }
      }
    }

    // 3. Try Anthropic
    if (provider === 'anthropic' && effectiveAnthropicKey) {
      logger.info('Calling LLM via Anthropic API...');
      try {
        const client = new Anthropic({ apiKey: effectiveAnthropicKey });
        const body: any = {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        };
        const response = await client.messages.create(body);
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        if (text) return text;
      } catch (err) {
        logger.error('Anthropic LLM call failed...', { error: (err as Error).message });
      }
    }
  }

  throw new Error('AI service configuration is incomplete or all models failed. Please check the API keys.');
}
