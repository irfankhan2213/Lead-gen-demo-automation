/**
 * @file AI-powered demo site generator using Claude claude-sonnet-4-6.
 * Takes a template HTML string and business data, then uses Claude to fill
 * in all the copy sections with high-quality, on-brand content.
 *
 * @param lead - Full lead data including AI analysis results
 * @param templateHtml - Base HTML template string
 * @returns Complete HTML string ready for deployment
 */

import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';

/**
 * Generates AI-written copy sections for a demo site.
 * Returns a record of section names to content strings.
 *
 * @param lead - Lead data with AI analysis
 */
export async function generateSiteCopy(lead: Partial<Lead>): Promise<Record<string, string>> {
  const prompt = `You are an expert web copywriter. Generate professional, on-brand website copy for a local business demo site.

BUSINESS INFO:
- Name: ${lead.business_name}
- Niche: ${lead.niche}
- City: ${lead.city}
- Tagline: ${lead.tagline ?? 'none'}
- Services: ${(lead.services ?? []).slice(0, 6).join(', ')}
- Rating: ${lead.google_rating ? `${lead.google_rating}/5 (${lead.google_review_count} reviews)` : 'not available'}
- Brand DNA: ${lead.brand_dna ?? 'professional local business'}
- Tone: ${lead.tone ?? 'professional'}
- Pain points we're solving: ${(lead.pain_points ?? []).join(', ')}

Return ONLY valid JSON with this structure:
{
  "nav_tagline": "short nav brand message (3-5 words)",
  "hero_headline": "${lead.hero_headline ?? 'Compelling headline here'}",
  "hero_subline": "${lead.hero_subline ?? 'Supporting subline here'}",
  "cta_primary": "${lead.cta_text ?? 'Book Now'}",
  "cta_secondary": "Learn More",
  "about_heading": "About Us heading (2-4 words)",
  "about_para_1": "First about paragraph (2-3 sentences, warm and specific)",
  "about_para_2": "Second about paragraph (1-2 sentences, mention city and local pride)",
  "services_heading": "Our Services heading",
  "service_1_name": "${(lead.services ?? ['Service 1'])[0]}",
  "service_1_desc": "1 sentence description of service 1",
  "service_2_name": "${(lead.services ?? ['Service', 'Service 2'])[1] ?? 'Service 2'}",
  "service_2_desc": "1 sentence description of service 2",
  "service_3_name": "${(lead.services ?? ['Service', 'Service', 'Service 3'])[2] ?? 'Service 3'}",
  "service_3_desc": "1 sentence description of service 3",
  "testimonial_heading": "What Our Clients Say",
  "testimonial_1": "A realistic positive review from a happy customer (1-2 sentences)",
  "testimonial_1_author": "First name + last initial, location",
  "testimonial_2": "Another realistic positive review (1-2 sentences)",
  "testimonial_2_author": "First name + last initial",
  "cta_section_heading": "Ready to get started?",
  "cta_section_sub": "1 line CTA that feels urgent but not pushy",
  "footer_tagline": "Short brand footer tagline"
}

Write in the tone: ${lead.tone ?? 'professional'}. 
Be specific to the business — mention ${lead.city} where natural.
Do NOT use placeholder text. Make it sound like a real, professional site.`;

  const text = await callLLM(prompt, 2048);
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(jsonStr) as Record<string, string>;
  } catch {
    logger.warn('Failed to parse AI site copy JSON, using defaults');
    return {
      hero_headline: lead.hero_headline ?? `Welcome to ${lead.business_name}`,
      hero_subline: lead.hero_subline ?? `Proudly serving ${lead.city}`,
      cta_primary: lead.cta_text ?? 'Contact Us',
    };
  }
}
