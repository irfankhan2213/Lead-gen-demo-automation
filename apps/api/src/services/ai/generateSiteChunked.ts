/**
 * @file Chunked HTML generation pipeline.
 * Splits landing page generation into 5 sequential LLM calls to:
 *  - Stay within per-model output token limits
 *  - Avoid single-point-of-failure on one large generation
 *  - Allow retrying individual failed sections without regenerating the whole page
 */

import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';
import { designLanguages } from './prompts/designLanguages.js';
import { cleanScrapedImages, getNicheImages } from '../demo/images.js';

// Pause between chunk calls to help with rate limits (1.5 seconds)
const INTER_CHUNK_DELAY = 1500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Business context string (shared across all chunks) ───────────────────────

function buildBusinessContext(lead: Lead): string {
  const cleanedScraped = cleanScrapedImages(lead.scraped_images || []);
  const nicheStock = getNicheImages(lead.niche || '');
  
  // Choose high-quality hero image: use custom scraped photo if it exists, else fall back to niche stock hero
  const heroImage = lead.hero_image_url || cleanedScraped[0] || nicheStock[0];
  
  // Gather other high-res imagery
  const galleryImages = cleanedScraped.length > 1 ? cleanedScraped.slice(1, 5) : nicheStock.slice(1, 4);

  return `
BUSINESS DATA (use these values, do NOT use placeholder variables):
  Name: ${lead.business_name}
  City: ${lead.city}
  Niche: ${lead.niche}
  Phone: ${lead.phone || 'N/A'}
  Address: ${lead.address || 'N/A'}
  Tagline: ${lead.hero_headline || lead.tagline || `Premium ${lead.niche} in ${lead.city}`}
  Subline: ${lead.hero_subline || ''}
  About: ${lead.about_text?.slice(0, 400) || ''}
  Services: ${(lead.services || []).slice(0, 6).join(', ') || 'General Services'}
  Brand Colors: ${(lead.brand_colors || []).join(', ') || '#1A1A2E, #F59E0B'}
  Google Rating: ${lead.google_rating || '4.8'} (${lead.google_review_count || '120'}+ reviews)
  Logo URL: ${lead.logo_url || ''}
  Hero Image: ${heroImage}
  Section Gallery Images (Use these for about, services, testimonials, etc.): ${galleryImages.join(', ')}
  CTA Text: ${lead.cta_text || 'Get a Free Quote'}
  Design Language: ${lead.design_language || 'corporate'}

CRITICAL IMAGE SELECTION RULES:
  - You MUST use the exact URLs provided in "Hero Image" and "Section Gallery Images".
  - Do NOT invent or make up any image URLs.
  - Do NOT use tiny images, icons, or social media logos as section photos.
  - Ensure the hero image is styled with CSS to cover the section (e.g., using Tailwind classes like 'bg-cover bg-center').`.trim();
}

// ─── Chunk 1: <head> + Navbar + Hero ─────────────────────────────────────────

async function genChunk1(lead: Lead, styleRules: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const prompt = `You are a world-class Webflow developer. You are building a ${lead.design_language || 'corporate'} style landing page using Tailwind CSS v3.
${ctx}

DESIGN SYSTEM (${(lead.design_language || 'corporate').toUpperCase()}):
${styleRules.slice(0, 2000)}

OUTPUT INSTRUCTIONS:
- Output raw HTML only. NO markdown, NO explanation. Start with <!DOCTYPE html> and end AFTER </header> (but before any main sections).
- Include:
  1. <!DOCTYPE html><html><head> with: title, meta description, Tailwind CDN, Google Fonts link, custom style block for design tokens.
  2. <body> opening tag.
  3. STICKY NAVBAR with: logo (use "${lead.business_name}", include actual logo img if Logo URL is not empty), navigation links (About, Services, Contact), CTA button.
  4. HERO SECTION: Full-viewport hero with overlay. Background = the Hero Image URL. Includes: headline ("${lead.hero_headline || lead.tagline || ''}"), subline, two CTA buttons, and a scroll indicator.
  5. TRUST BAR: A row of stats directly below the hero: Google Rating (${lead.google_rating || '4.8'} ⭐), ${lead.google_review_count || '120'}+ Reviews, Years in Business, etc.
- Stop output AFTER the trust bar's closing </section> tag. Do NOT include About, Services, or Footer.`;

  const html = await callLLM(prompt, 2000, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL);
  return html;
}

// ─── Chunk 2: About + Services ────────────────────────────────────────────────

async function genChunk2(lead: Lead, styleRules: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const servicesList = (lead.services || ['Our Service 1', 'Our Service 2', 'Our Service 3']).slice(0, 6);
  const prompt = `You are a world-class Webflow developer. You are writing the MIDDLE SECTIONS of a ${lead.design_language || 'corporate'} style landing page using Tailwind CSS v3.
${ctx}

DESIGN SYSTEM (${(lead.design_language || 'corporate').toUpperCase()}):
${styleRules.slice(0, 1500)}

OUTPUT INSTRUCTIONS:
- Output raw HTML only for these TWO sections. NO markdown, NO <!DOCTYPE>, NO <html>, NO <head>, NO <body> tag. Just the section elements.
- Write ONLY these two sections:

  1. ABOUT SECTION (id="about"): 2-column layout. Left: compelling about copy for "${lead.business_name}" — brand story, owner background, why they're the best in ${lead.city}. Right: a styled image block or decorative card using the Hero Image or a scraped image.

  2. SERVICES SECTION (id="services"): Write out EXACTLY ${servicesList.length} individual service cards in a grid. Each card has: unique icon (emoji or SVG), title, and 2-sentence description. Services: ${servicesList.join(' | ')}. DO NOT write a loop. DO NOT use placeholders. Write each card's HTML manually.

- Stop after the closing </section> of the Services grid.`;

  const html = await callLLM(prompt, 2000, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL);
  return html;
}

// ─── Chunk 3: Testimonials + Contact Form ─────────────────────────────────────

async function genChunk3(lead: Lead, styleRules: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const prompt = `You are a world-class Webflow developer. You are writing SOCIAL PROOF and CONTACT sections of a ${lead.design_language || 'corporate'} landing page using Tailwind CSS v3.
${ctx}

DESIGN SYSTEM:
${styleRules.slice(0, 1000)}

OUTPUT INSTRUCTIONS:
- Output raw HTML only. NO markdown, NO <!DOCTYPE>, NO <html>, NO <head>. Just section elements.
- Write ONLY these two sections:

  1. TESTIMONIALS SECTION (id="testimonials"): 3 customer review cards. Each has: star rating (5 stars), review text (2-3 sentences, niche-specific, referencing ${lead.business_name} or ${lead.city}), reviewer name, and a realistic avatar (use Unsplash portrait URLs). Make reviews sound authentic and specific.

  2. CONTACT SECTION (id="contact"): 2-column layout.
     Left column: Business info list (address: "${lead.address || ''}", phone: "${lead.phone || ''}", hours, email placeholder) in a styled card.
     Right column: Contact form with fields: Name, Email, Phone, Message, and a styled Submit button with the text "${lead.cta_text || 'Send Message'}".

- Stop after the closing </section> of the contact section.`;

  const html = await callLLM(prompt, 1800, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL);
  return html;
}

// ─── Chunk 4: Footer + Claim Banner ──────────────────────────────────────────

async function genChunk4(lead: Lead): Promise<string> {
  const prompt = `You are building the FOOTER for a landing page for "${lead.business_name}" (${lead.niche}, ${lead.city}).

OUTPUT INSTRUCTIONS:
- Output raw HTML only. NO markdown, NO <!DOCTYPE>, NO <html>. Just the footer and a fixed bottom banner.
- Write ONLY these two elements:
  1. FOOTER: Clean, professional footer using Tailwind CSS. Includes: business name, navigation links (About, Services, Contact), copyright "${new Date().getFullYear()} ${lead.business_name}. All rights reserved.", and brand colors from: ${(lead.brand_colors || ['#1A1A2E', '#F59E0B']).join(', ')}.
  2. CLAIM BANNER: A fixed banner at the very bottom (position:fixed, bottom:0, z-index:9999) with dark background stating: "🚀 This is a free demo site built by Evolve Expert Agency." and a gold button: [Claim Your Site →] linking to mailto:hello@evolve.agency.

Then close the </body></html> tags.`;

  const html = await callLLM(prompt, 800, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL);
  return html;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function generateSiteHtmlChunked(lead: Lead): Promise<string> {
  const designStyle = lead.design_language || 'corporate';
  const styleRules = designLanguages[designStyle] || designLanguages['corporate'];

  logger.info(`[ChunkedGen] Starting 4-chunk generation for "${lead.business_name}"`, { style: designStyle });

  const chunks: string[] = [];
  const chunkFns = [
    { name: 'chunk1 (Head+Navbar+Hero+TrustBar)', fn: () => genChunk1(lead, styleRules) },
    { name: 'chunk2 (About+Services)', fn: () => genChunk2(lead, styleRules) },
    { name: 'chunk3 (Testimonials+Contact)', fn: () => genChunk3(lead, styleRules) },
    { name: 'chunk4 (Footer+Banner)', fn: () => genChunk4(lead) },
  ];

  for (let i = 0; i < chunkFns.length; i++) {
    const { name, fn } = chunkFns[i];
    try {
      logger.info(`[ChunkedGen] Generating ${name}...`);
      const chunkHtml = await fn();

      // Basic validation — chunk should contain actual HTML tags
      if (!chunkHtml || chunkHtml.length < 100 || !chunkHtml.includes('<')) {
        throw new Error(`${name} returned empty or invalid output`);
      }

      chunks.push(chunkHtml.trim());
      logger.info(`[ChunkedGen] ${name} complete — ${chunkHtml.length} chars`);

      // Delay between chunks to avoid rate-limit bursts
      if (i < chunkFns.length - 1) {
        await sleep(INTER_CHUNK_DELAY);
      }
    } catch (err) {
      logger.error(`[ChunkedGen] ${name} failed`, { error: (err as Error).message });
      throw err;
    }
  }

  // Stitch all chunks together
  // Chunk 1 provides <!DOCTYPE html>...<body>...[hero]
  // Chunks 2-3 are <section>...</section> blocks
  // Chunk 4 closes </body></html>
  let fullHtml = chunks[0];

  // Remove any accidental </body></html> endings from chunk 1
  fullHtml = fullHtml.replace(/<\/body\s*>\s*<\/html\s*>/gi, '').trimEnd();

  // Remove any accidental <!DOCTYPE>/html/body tags from middle chunks
  for (let i = 1; i < chunks.length - 1; i++) {
    let chunk = chunks[i];
    chunk = chunk.replace(/<!DOCTYPE[^>]*>/gi, '');
    chunk = chunk.replace(/<html[^>]*>/gi, '');
    chunk = chunk.replace(/<\/html>/gi, '');
    chunk = chunk.replace(/<head[\s\S]*?<\/head>/gi, '');
    chunk = chunk.replace(/<body[^>]*>/gi, '');
    chunk = chunk.replace(/<\/body>/gi, '');
    fullHtml += '\n' + chunk.trim();
  }

  // Last chunk should close </body></html>
  let lastChunk = chunks[chunks.length - 1];
  lastChunk = lastChunk.replace(/<!DOCTYPE[^>]*>/gi, '');
  lastChunk = lastChunk.replace(/<html[^>]*>/gi, '');
  lastChunk = lastChunk.replace(/<head[\s\S]*?<\/head>/gi, '');
  lastChunk = lastChunk.replace(/<body[^>]*>/gi, '');
  fullHtml += '\n' + lastChunk.trim();

  // Ensure </body></html> is present
  if (!fullHtml.includes('</html>')) {
    fullHtml += '\n</body>\n</html>';
  }

  logger.info(`[ChunkedGen] Complete. Total size: ${(fullHtml.length / 1024).toFixed(1)}KB, ${fullHtml.split('\n').length} lines`);
  return fullHtml;
}
