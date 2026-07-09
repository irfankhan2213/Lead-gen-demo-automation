/**
 * @file AI cold email writer using Claude claude-sonnet-4-6.
 * Uses the PATTERN: Observation → Problem → Solution (proof) → CTA
 * Generates high-converting cold outreach emails with the demo URL as the hook.
 *
 * @param lead - Full lead data
 * @param demoUrl - Live deployed demo URL
 * @returns GeneratedEmail with subject and body
 */

import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead, GeneratedEmail } from '@acquisition-engine/shared';

/**
 * Writes a cold outreach email for a lead using Claude.
 *
 * @param lead - Full lead with all scraped data and AI analysis
 * @param demoUrl - Live demo URL to include in the email
 * @returns Email subject and body
 */
export async function writeEmail(lead: Partial<Lead>, demoUrl: string): Promise<GeneratedEmail> {
  const prompt = `You are a world-class cold email copywriter for a digital agency.
Write a cold outreach email to a local business owner.

STRICT RULES:
- Subject line: under 8 words, curiosity-driven, no emojis, no "Hey" opener
- Email body: under 120 words total
- Line 1: reference something SPECIFIC about their business (shows you did real research)
- Line 2: identify ONE specific pain point
- Line 3: "I built something for you" then drop the demo URL on its own line
- Line 4: soft CTA — not "buy now", something like "worth a quick look?"
- Sign off: first name only + no title
- Tone: human, direct, confident — NOT salesy, NOT formal
- NEVER say: "I hope this email finds you well"
- NEVER say: "I came across your business"
- NEVER say: "I wanted to reach out"
- DO reference their actual specific data (name, rating, city, services)

BUSINESS DATA:
- Name: ${lead.business_name}
- City: ${lead.city}
- Niche: ${lead.niche}
- Rating: ${lead.google_rating ? `${lead.google_rating}/5 (${lead.google_review_count} reviews on Google)` : 'No Google rating found'}
- Website: ${lead.website_url ?? 'NO WEBSITE — they have no online presence at all'}
- Services: ${(lead.services ?? []).slice(0, 4).join(', ') || 'unknown'}
- Pain points identified: ${(lead.pain_points ?? []).join('; ')}
- Brand DNA: ${lead.brand_dna ?? ''}

DEMO URL: ${demoUrl}

CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON, nothing else. No markdown blocks.
- Escape all newlines in the body text using \\n. Do not use literal newlines inside the JSON string.
- Escape any quotes using \\".

{
  "subject": "...",
  "body": "..."
}`;

  try {
    const text = await callLLM(prompt, 512);
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const email = JSON.parse(jsonStr) as GeneratedEmail;

    logger.info(`Email written for ${lead.business_name}`, {
      subject: email.subject,
      wordCount: email.body.split(' ').length,
    });

    return email;
  } catch (err) {
    logger.error('Email generation failed', { error: (err as Error).message });
    throw err;
  }
}

/**
 * Writes a follow-up email for a lead that hasn't responded.
 *
 * @param lead - Lead data
 * @param demoUrl - Demo URL to re-reference
 * @param followUpNumber - Which follow-up this is (1, 2, or 3)
 * @returns Email subject and body
 */
export async function writeFollowUpEmail(
  lead: Partial<Lead>,
  demoUrl: string,
  followUpNumber: 1 | 2 | 3
): Promise<GeneratedEmail> {
  const templates = {
    1: `Write a 2-3 line follow-up email. Ask if they had a chance to see the demo site you built for them.
        Reference the demo URL again. Keep it light and friendly. Under 40 words.`,
    2: `Write a follow-up email adding social proof. Mention that you've helped similar ${lead.niche} businesses 
        in ${lead.city} get more customers through their new website. Under 60 words.`,
    3: `Write a "breakup email" — tell them you're closing their file and this is the last time you'll 
        reach out. Short, friendly, no pressure. Leave the door open. Under 40 words.`,
  };

  const prompt = `You are writing follow-up cold email #${followUpNumber} for ${lead.business_name}.

Context: You previously sent them a demo website you built at: ${demoUrl}
They haven't responded yet.

${templates[followUpNumber]}

BUSINESS: ${lead.business_name} | ${lead.city} | ${lead.niche}

CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON, nothing else. No markdown blocks.
- Escape all newlines in the body text using \\n. Do not use literal newlines inside the JSON string.
- Escape any quotes using \\".

{
  "subject": "Re: [original subject or short new subject]",
  "body": "..."
}`;

  const text = await callLLM(prompt, 256);
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonStr) as GeneratedEmail;
}
