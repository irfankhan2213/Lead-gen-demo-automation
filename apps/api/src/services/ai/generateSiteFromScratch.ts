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
import { getGuaranteedImages } from '../demo/images.js';

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
  const styleRules = (designLanguages[designStyle] || designLanguages['corporate']).slice(0, 4000);
  const [heroImage, img1, img2, img3] = getGuaranteedImages(lead);

  const prompt = `You are a world-class Webflow developer and UI/UX designer.
Your task is to write the COMPLETE, single-file HTML code for a modern, hyper-premium landing page.
You MUST use Tailwind CSS v3 via CDN (<script src="https://cdn.tailwindcss.com"></script>).

═══ MANDATORY DESIGN STYLE: ${designStyle.toUpperCase()} ═══
Apply every design system rule below for the ${designStyle} style — colors, typography, radius, shadows, layout.

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

━━━ IMAGE URLS — MANDATORY (copy these EXACTLY into src and background-image) ━━━
HERO_IMAGE    = ${heroImage}
GALLERY_IMG_1 = ${img1}
GALLERY_IMG_2 = ${img2}
GALLERY_IMG_3 = ${img3}

⚠️  IMAGE RULES (CRITICAL):
1. Hero section MUST use style="background-image:url(${heroImage})" or <img src="${heroImage}">.
2. Use GALLERY_IMG_1, GALLERY_IMG_2, GALLERY_IMG_3 in About, Services, Testimonials.
3. DO NOT invent or hallucinate any image URLs. Only use the 4 URLs listed above.
4. All <img> tags must have a valid src — never src="" or src="undefined".

DESIGN SYSTEM (${designStyle.toUpperCase()}):
${styleRules}

PAGE STRUCTURE (write all sections):
1. Sticky Navbar: Logo, nav links (About, Services, Contact), CTA button.
2. Hero Section: Full-viewport, background image, overlay, headline, subline, 2 CTAs, scroll indicator.
3. Trust Bar: Google Rating (${lead.google_rating || '4.8'} ⭐), ${lead.google_review_count || '120'}+ Reviews, years in business.
4. About Section: 2-col layout with brand story and image.
5. Services Section: ${(lead.services || []).length || 3} service cards/items matching the design style.
6. Testimonials: 3 review cards with star ratings, quotes, reviewer names.
7. Contact Section: Business info + contact form with Submit button.
8. Footer: Business name, nav links, copyright © ${new Date().getFullYear()}.
9. Claim Banner: Fixed bottom bar — "🚀 This is a free demo site built by Evolve Expert Agency." + "Claim Your Site →" (mailto:hello@evolve.agency).

CODE RULES:
- Static HTML only. No React, no JSX, no template literals.
- Output MUST be at least 300 lines.
- Return ONLY raw HTML starting with <!DOCTYPE html>.

START YOUR RESPONSE WITH <!DOCTYPE html>.`;

  try {
    const text = await callLLM(prompt, 4096, false, undefined, undefined, false, true);
    return sanitizeHtml(text, lead);
  } catch (err) {
    logger.error('[SiteGen] Single-call fallback also failed', { error: (err as Error).message });
    throw err;
  }
}
