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
const prompt = `You are an elite, high-ticket B2B cold email copywriter.
Write a highly persuasive, curiosity-driven cold outreach email to a local business owner.

STRICT RULES:
- Subject line: under 6 words, highly personalized, no emojis. Make it look like an internal email.
- Email body: under 100 words total. Keep it punchy and easy to read on mobile.
- Line 1: Reference a hyper-specific detail about their business (shows you actually looked them up).
- Line 2: Hit a hard pain point about their current online presence, reputation, or missed revenue.
- Line 3: "I actually went ahead and built a custom high-converting site for you. You can see it here:"
- Line 4 (on its own line): the demo URL.
- Line 5: Soft, low-friction CTA (e.g., "Worth a 5-minute chat next week to see how this can drive more bookings?").
- Sign off: "Best, [Your Name]"
- Tone: confident, direct, value-driven. No fluff. NOT salesy. 
- NEVER use generic openers like "I hope this finds you well" or "I came across your business".
- CRITICAL: Make the pitch about revenue, bookings, and outcompeting local rivals.

BUSINESS DATA:
- Name: ${lead.business_name}
- City: ${lead.city}
- Niche: ${lead.niche}
- Rating: ${lead.google_rating ? `${lead.google_rating}/5 (${lead.google_review_count} reviews on Google)` : 'No Google rating found'}
- Website: ${lead.website_url ?? 'NO WEBSITE — they are missing out on significant online traffic'}
- Services: ${(lead.services ?? []).slice(0, 4).join(', ') || 'unknown'}
- Pain points identified: ${(lead.pain_points ?? []).join('; ')}
- Brand DNA: ${lead.brand_dna ?? ''}

DEMO URL: ${demoUrl}

CRITICAL FORMATTING RULES:
- Do NOT output JSON.
- Output EXACTLY like this:
SUBJECT: [your subject here]
BODY:
[your email body here]`;

  try {
    const text = await callLLM(
      prompt,
      512,
      false,
      process.env.EMAIL_PROVIDER as any,
      process.env.EMAIL_MODEL,
      true
    );
    
    // Parse the text output manually to avoid JSON escaping issues
    let subject = '';
    let body = '';
    
    const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    } else {
      // Fallback if AI didn't follow formatting perfectly
      subject = 'Quick question';
    }
    
    const bodySplit = text.split(/BODY:/i);
    if (bodySplit.length > 1) {
      body = bodySplit[1].trim();
    } else {
      // Fallback
      body = text.replace(/SUBJECT:\s*(.+)/i, '').trim();
    }

    const email: GeneratedEmail = { subject, body };

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

CRITICAL FORMATTING RULES:
- Do NOT output JSON.
- Output EXACTLY like this:
SUBJECT: Re: [original subject or short new subject]
BODY:
[your email body here]`;

  const text = await callLLM(prompt, 256);
  let subject = 'Re: Quick question';
  let body = text;

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  if (subjectMatch) subject = subjectMatch[1].trim();

  const bodySplit = text.split(/BODY:/i);
  if (bodySplit.length > 1) {
    body = bodySplit[1].trim();
  } else {
    body = text.replace(/SUBJECT:\s*(.+)/i, '').trim();
  }

  return { subject, body };
}
