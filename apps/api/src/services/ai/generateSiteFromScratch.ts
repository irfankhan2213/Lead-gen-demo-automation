/**
 * @file Site generation entry point.
 * Primary strategy: chunked multi-call pipeline (generateSiteHtmlChunked).
 * Fallback strategy: single large LLM call (legacy).
 */

import { callLLM } from './client.js';
import { generateSiteHtmlChunked } from './generateSiteChunked.js';
import { sanitizeHtml } from './sanitizeHtml.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';
import { designLanguages } from './prompts/designLanguages.js';

const GEN_PROVIDER = (process.env.GENERATION_LLM_PROVIDER || 'openai') as any;
const GEN_MODEL = process.env.OPENAI_GENERATION_MODEL || process.env.OPENAI_MODEL;

export async function generateSiteHtmlFromScratch(lead: Lead): Promise<string> {
  // ── Primary: Chunked strategy ──────────────────────────────────────────────
  try {
    logger.info(`[SiteGen] Using chunked strategy for "${lead.business_name}"...`);
    const html = await generateSiteHtmlChunked(lead);
    return sanitizeHtml(html, lead);
  } catch (chunkedErr) {
    logger.warn(`[SiteGen] Chunked strategy failed. Falling back to single-call.`, {
      error: (chunkedErr as Error).message,
    });
  }

  // ── Fallback: Single large LLM call (legacy) ───────────────────────────────
  logger.info(`[SiteGen] Attempting single-call fallback for "${lead.business_name}"...`);
  const designStyle = lead.design_language || 'corporate';
  const styleRules = designLanguages[designStyle] || designLanguages['corporate'];

  const prompt = `You are a world-class Webflow developer and UI/UX designer.
Your task is to write the COMPLETE, single-file HTML code for a modern, hyper-premium landing page for a local business.
You must use Tailwind CSS v3 via CDN (<script src="https://cdn.tailwindcss.com"></script>). Do not use any external CSS files or older Tailwind v2 CDN.

BUSINESS DATA:
Name: ${lead.business_name}
City: ${lead.city}
Niche: ${lead.niche}
Tagline: ${lead.hero_headline || lead.tagline || ''}
About: ${lead.about_text || ''}
Services: ${(lead.services || []).join(', ')}
Brand Colors: ${(lead.brand_colors || []).join(', ')}
Phone: ${lead.phone || ''}
Address: ${lead.address || ''}
Logo URL: ${lead.logo_url || ''}
Scraped Website Images: ${(lead.scraped_images || []).join(', ')}
Hero Image URL: ${lead.hero_image_url || (lead.scraped_images && lead.scraped_images[0]) || 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&q=80&w=1600'}

IMAGE RULES:
1. If a "Logo URL" is provided above, you MUST use it as the '<img>' src for the navigation bar and footer logo.
2. If "Scraped Website Images" are provided above, you MUST prioritize using these actual image URLs for the hero background, service/product cards, testimonial avatars, and gallery layout to display the business's real photos.
3. If no "Scraped Website Images" are available, use niche-specific, high-quality Unsplash image URLs.

HTML CODING CONSTRAINTS (CRITICAL):
1. **NO REACT OR JSX:** Do NOT use React, Vue, JSX, or ES6 template string evaluations in the HTML.
2. **WRITE FULL STATIC HTML:** Write out the full HTML structure for every element manually.
3. **USE ACTUAL CONTENT:** Replace all placeholders with actual text.
4. **VALID IMG SRCs:** Ensure all image 'src' attributes contain valid, absolute URLs.
5. **LENGTH AND DETAIL (CRITICAL):** Output MUST be at least 200 lines of code. Do NOT abbreviate.

DESIGN SYSTEM INSTRUCTIONS (${designStyle.toUpperCase()} STYLE):
${styleRules.slice(0, 3000)}

PRE-BUILT TEMPLATE STRUCTURE:
1. **Navbar**: Sticky navigation bar. Logo, links, CTA button.
2. **Hero Section**: Large impact section with background image, headline, subline, CTAs.
3. **Stats / Trust Bar**: Google Rating (${lead.google_rating || '4.8'} ⭐), review count, trust signals.
4. **About Section**: 2-column layout with about copy and image.
5. **Services Section**: Grid of ${(lead.services || []).length || 3} service cards with icons, titles, descriptions.
6. **Testimonials**: 3 review cards with names and ratings.
7. **Contact Section**: Address/phone on left, contact form on right.
8. **Footer**: Business name, links, copyright.
9. **Claim Banner**: Fixed bottom bar — "This is a free demo site built by Evolve Expert Agency. [Claim Your Site →]" linking to mailto:hello@evolve.agency.

OUTPUT CONSTRAINTS:
- Return ONLY the raw HTML string starting with "<!DOCTYPE html>". No markdown formatting, no explanations.

START YOUR RESPONSE WITH "<!DOCTYPE html>".`;

  try {
    const text = await callLLM(prompt, 4096, false, GEN_PROVIDER, GEN_MODEL);
    return sanitizeHtml(text, lead);
  } catch (err) {
    logger.error('[SiteGen] Single-call fallback also failed', { error: (err as Error).message });
    throw err;
  }
}
