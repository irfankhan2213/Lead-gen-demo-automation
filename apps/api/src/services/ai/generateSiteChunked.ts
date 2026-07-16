/**
 * @file Chunked HTML generation pipeline.
 * Splits landing page generation into 4 sequential LLM calls to:
 *  - Stay within per-model output token limits
 *  - Avoid single-point-of-failure on one large generation
 *  - Allow retrying individual failed chunks without regenerating the whole page
 *
 * Chunk layout:
 *  1. <head> + Sticky Navbar + Hero + Trust Bar
 *  2. About + Services
 *  3. Testimonials + Contact Form
 *  4. Footer + Claim Banner + </body></html>
 */

import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';
import { designLanguages } from './prompts/designLanguages.js';
import { getGuaranteedImages } from '../demo/images.js';

// ─── Configurable delay between chunk LLM calls ───────────────────────────────
// Increase if you hit consecutive rate limits. Configurable via env.
const INTER_CHUNK_DELAY = parseInt(process.env.SITE_GEN_CHUNK_DELAY_MS || '2500', 10);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Per-chunk retry helper ───────────────────────────────────────────────────

/**
 * Retries a chunk generation function up to maxAttempts times with exponential backoff.
 * Throws after all attempts are exhausted.
 */
async function retryChunk<T>(
  name: string,
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`[ChunkedGen] ${name} — attempt ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      logger.warn(`[ChunkedGen] ${name} attempt ${attempt} failed: ${lastErr.message}`);
      if (attempt < maxAttempts) {
        const wait = Math.min(3000 * Math.pow(2, attempt - 1), 20_000);
        logger.info(`[ChunkedGen] Waiting ${wait}ms before retry...`);
        await sleep(wait);
      }
    }
  }
  throw new Error(`[ChunkedGen] ${name} failed after ${maxAttempts} attempts: ${lastErr.message}`);
}

// ─── Per-chunk structural validators ─────────────────────────────────────────

function validateChunk(name: string, html: string, chunkIndex: number): void {
  if (!html || html.length < 150) {
    throw new Error(`${name} returned empty or near-empty output (${html?.length ?? 0} chars)`);
  }
  if (!html.includes('<')) {
    throw new Error(`${name} returned non-HTML output`);
  }

  if (chunkIndex === 0) {
    // Chunk 1 must have a full document shell
    if (!html.toLowerCase().includes('<html')) throw new Error(`${name}: missing <html> tag`);
    if (!html.toLowerCase().includes('<head')) throw new Error(`${name}: missing <head> tag`);
    if (!html.toLowerCase().includes('<body')) throw new Error(`${name}: missing <body> tag`);
    if (!html.toLowerCase().includes('<nav') && !html.toLowerCase().includes('navbar')) {
      throw new Error(`${name}: missing navbar`);
    }
  }

  if (chunkIndex === 1 || chunkIndex === 2) {
    // Middle chunks must be section elements
    if (!html.toLowerCase().includes('<section')) {
      throw new Error(`${name}: missing <section> elements`);
    }
  }

  if (chunkIndex === 3) {
    // Last chunk must close the document
    if (!html.toLowerCase().includes('</body') && !html.toLowerCase().includes('</html')) {
      throw new Error(`${name}: missing closing </body></html>`);
    }
  }
}

// ─── Per-design layout hints injected into chunk prompts ─────────────────────

const DESIGN_LAYOUT_HINTS: Record<string, string> = {
  luxury: `LAYOUT RULES (LUXURY):
- Use MASSIVE typography (hero headline text-7xl to text-9xl, tight leading).
- Hero: full-viewport dark overlay with centered editorial text block; grayscale image that reveals color on hover.
- About: asymmetric 2-col — wide text on left, tall portrait image on right with visible grid lines.
- Services: single-column stacked list with numbered index, thin top-border separators, NO cards.
- Testimonials: full-width dark section, italic serif quotes in large text, thin gold dividers.
- Use generous whitespace (py-32, px-16). Strict rectangular (0px radius) everywhere.`,

  swiss: `LAYOUT RULES (SWISS INTERNATIONAL):
- Strict mathematical grid, asymmetric layouts, lots of negative space.
- Hero: dark background, headline in massive bold uppercase Inter, red accent stripe.
- Visible dot-grid or line-grid pattern in the background.
- Services: alternating left/right text+image rows, not a card grid.
- Typography: UPPERCASE labels everywhere, tracking-widest.`,

  flat: `LAYOUT RULES (FLAT DESIGN):
- Bold solid color blocks (no gradients, no shadows), geometric shapes.
- Hero: large illustrated background in one solid color, white text, pill-shaped CTA.
- Services: colorful icon+title cards with flat background blocks.
- Clear separation between sections with contrasting solid color backgrounds.`,

  material: `LAYOUT RULES (MATERIAL DESIGN 3):
- Rounded pill buttons (border-radius: 9999px), elevated floating cards.
- Hero: light pastel background with centered content, soft shadow under CTA.
- Cards: rounded-2xl with subtle elevation shadow, colored top accent strip.
- Testimonials: floating speech-bubble cards with circular avatar images.`,

  claymorphism: `LAYOUT RULES (CLAYMORPHISM):
- Everything inflated, puffy, pastel. Cards with border-radius 32px+, heavy inner shadow.
- Hero: gradient pastel sky background, large bouncy headline, floating 3D blob shapes.
- Service cards: pastel-colored, glossy with inset shadow for depth.
- Use @keyframes float animation on hero elements for a playful feel.`,

  neumorphism: `LAYOUT RULES (NEUMORPHISM):
- Monochromatic cool-grey background (#E0E0E0), soft pushed/raised shadows.
- All cards use: box-shadow: 9px 9px 16px #bebebe, -9px -9px 16px #ffffff.
- Buttons feel "pressed in" with inset shadow on active state.
- NO color accents except for one brand highlight. All section backgrounds the same grey.`,

  industrial: `LAYOUT RULES (INDUSTRIAL):
- Dark (#121212) background, monospace font, safety-orange (#FF6600) accents.
- Hero: dark background with subtle grid overlay, all-caps headline, orange CTA.
- Services: sharp rectangular cards with visible border, numbered with monospace.
- Section dividers: bold horizontal orange lines.`,

  corporate: `LAYOUT RULES (CORPORATE):
- Classic, trustworthy navy+gold palette, Playfair Display headings, Inter body.
- Hero: professional photography background, centered headline with semi-transparent overlay.
- Services: clean 3-column card grid with light shadow and top accent border.
- Trust bar with certifications, years in business, Google rating prominently displayed.`,

  botanical: `LAYOUT RULES (BOTANICAL):
- Warm earthy tones: terracotta, sage green, cream, dusty rose. Organic textures.
- Hero: full bleed nature/plant photography, warm semi-transparent overlay, serif headline.
- About: layered asymmetric layout with leaf/floral decorative elements.
- Services: soft rounded cards with subtle paper-grain texture and muted palette.`,
};

// ─── Business context string (shared across all chunks) ───────────────────────

function buildBusinessContext(lead: Lead): string {
  const [heroImage, img1, img2, img3] = getGuaranteedImages(lead);

  return `
BUSINESS DATA (use these exact values — do NOT use placeholder variables):
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
  CTA Text: ${lead.cta_text || 'Get a Free Quote'}

━━━ IMAGE URLS — MANDATORY (copy these EXACTLY into src="..." and background-image:url(...)) ━━━
  HERO_IMAGE    = ${heroImage}
  GALLERY_IMG_1 = ${img1}
  GALLERY_IMG_2 = ${img2}
  GALLERY_IMG_3 = ${img3}

⚠️  IMAGE RULES (STRICTLY ENFORCED):
  1. You MUST use the HERO_IMAGE as the hero section background (style="background-image:url(HERO_IMAGE)") or as a full-bleed <img src="HERO_IMAGE">.
  2. You MUST use GALLERY_IMG_1, GALLERY_IMG_2, GALLERY_IMG_3 in the About, Services, and Testimonials sections as <img> elements.
  3. DO NOT invent, hallucinate, or make up any image URLs. Only use the 4 URLs listed above.
  4. DO NOT leave any image src="" empty. If you run out of images, repeat GALLERY_IMG_1.
  5. For logo: ${lead.logo_url ? `use <img src="${lead.logo_url}"> for the logo` : 'use text/initials — no logo URL available'}.`.trim();
}

// ─── Chunk 1: <head> + Navbar + Hero + Trust Bar ─────────────────────────────

async function genChunk1(lead: Lead, styleRules: string, layoutHint: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const style = lead.design_language || 'corporate';

  const prompt = `You are a world-class front-end developer. Build the OPENING of a landing page.

═══ MANDATORY DESIGN STYLE: ${style.toUpperCase()} ═══
${layoutHint}

${ctx}

FULL DESIGN SYSTEM (${style.toUpperCase()}):
${styleRules}

OUTPUT — write ONLY these elements, nothing else:
1. <!DOCTYPE html><html><head> — include: <title>, meta description, Tailwind CSS v3 CDN, Google Fonts link (matching the design style), custom <style> block with CSS variables and keyframe animations for the chosen style.
2. <body> opening tag (no closing).
3. STICKY NAVBAR — logo (text "${lead.business_name}"${lead.logo_url ? ` + <img src="${lead.logo_url}" class="h-8 w-auto" alt="logo">` : ''}), nav links (About, Services, Contact), CTA button. Style this navbar according to the ${style} design rules above.
4. HERO SECTION — use style="background-image:url(${(getGuaranteedImages(lead))[0]})" on the hero container with background-size:cover, background-position:center. Include: a dark/colored overlay div, the headline text "${lead.hero_headline || lead.tagline || `Premium ${lead.niche} in ${lead.city}`}", the subline "${lead.hero_subline || `Proudly serving ${lead.city}`}", two CTA buttons ("${lead.cta_text || 'Get a Free Quote'}" and "Learn More"), and a scroll indicator. Style according to ${style} layout rules.
5. TRUST BAR — row of stats: ⭐ ${lead.google_rating || '4.8'} Rating (${lead.google_review_count || '120'}+ Reviews), Years in Business, Clients Served. Style according to ${style}.

CRITICAL: Stop output AFTER the trust bar's closing </section>. Do NOT write About, Services, or any further sections.
Return RAW HTML only — no markdown, no explanations.`;

  const html = await callLLM(prompt, 3500, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL, false, true);
  return html;
}

// ─── Chunk 2: About + Services ────────────────────────────────────────────────

async function genChunk2(lead: Lead, styleRules: string, layoutHint: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const style = lead.design_language || 'corporate';
  const servicesList = (lead.services || ['Our Service 1', 'Our Service 2', 'Our Service 3']).slice(0, 6);
  const [, img1, img2] = getGuaranteedImages(lead);

  const prompt = `You are a world-class front-end developer. Write the MIDDLE SECTIONS of a landing page.

═══ MANDATORY DESIGN STYLE: ${style.toUpperCase()} ═══
${layoutHint}

${ctx}

FULL DESIGN SYSTEM (${style.toUpperCase()}):
${styleRules}

OUTPUT — write ONLY these two sections as raw HTML, no markdown, no <!DOCTYPE>, no <html>, no <head>, no <body> tag:

1. ABOUT SECTION (id="about"):
   - Layout per the ${style} design rules above.
   - Use <img src="${img1}" alt="About ${lead.business_name}" class="w-full h-full object-cover"> for the image column.
   - Include compelling brand copy for "${lead.business_name}" — story, why they are the best in ${lead.city}, what makes them unique.

2. SERVICES SECTION (id="services"):
   - Layout per the ${style} design rules above.
   - Write out EXACTLY ${servicesList.length} service items. Services: ${servicesList.join(' | ')}.
   - Use <img src="${img2}" alt="service"> inside at least one service card/row.
   - DO NOT write a JavaScript loop. DO NOT use placeholder variables. Write each service's HTML manually.
   - Each service must have: title, icon (emoji or inline SVG), and a 2-sentence description.

Stop after the closing </section> of the Services block.
Return RAW HTML only.`;

  const html = await callLLM(prompt, 3500, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL, false, true);
  return html;
}

// ─── Chunk 3: Testimonials + Contact Form ─────────────────────────────────────

async function genChunk3(lead: Lead, styleRules: string, layoutHint: string): Promise<string> {
  const ctx = buildBusinessContext(lead);
  const style = lead.design_language || 'corporate';
  const [, , , img3] = getGuaranteedImages(lead);

  const prompt = `You are a world-class front-end developer. Write the SOCIAL PROOF and CONTACT sections of a landing page.

═══ MANDATORY DESIGN STYLE: ${style.toUpperCase()} ═══
${layoutHint}

${ctx}

FULL DESIGN SYSTEM (${style.toUpperCase()}):
${styleRules}

OUTPUT — write ONLY these two sections as raw HTML, no markdown, no <!DOCTYPE>, no <html>, no <head>, no <body> tag:

1. TESTIMONIALS SECTION (id="testimonials"):
   - Layout per the ${style} design rules.
   - 3 customer review cards. Each: ★★★★★ star rating, 2-3 sentence authentic review (mention "${lead.business_name}" or "${lead.city}"), reviewer name, reviewer role/location.
   - Use <img src="https://i.pravatar.cc/80?img=${Math.floor(Math.random() * 70) + 1}" class="w-12 h-12 rounded-full object-cover"> for reviewer avatars.
   - Include <img src="${img3}" alt="Our work"> somewhere in this section as a visual accent.

2. CONTACT SECTION (id="contact"):
   - Layout per the ${style} design rules.
   - Left column: address "${lead.address || lead.city}", phone "${lead.phone || ''}", business hours, email.
   - Right column: contact form with Name, Email, Phone, Message fields, and a styled Submit button "${lead.cta_text || 'Send Message'}".

Stop after the closing </section> of the contact section.
Return RAW HTML only.`;

  const html = await callLLM(prompt, 2500, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL, false, true);
  return html;
}

// ─── Chunk 4: Footer + Claim Banner + </body></html> ─────────────────────────

async function genChunk4(lead: Lead): Promise<string> {
  const style = lead.design_language || 'corporate';
  const year = new Date().getFullYear();
  const brandColors = (lead.brand_colors || ['#1A1A2E', '#F59E0B']).join(', ');

  const prompt = `You are a world-class front-end developer. Write the FOOTER of a landing page.

BUSINESS: "${lead.business_name}" (${lead.niche}, ${lead.city})
DESIGN STYLE: ${style.toUpperCase()}
BRAND COLORS: ${brandColors}

OUTPUT — write ONLY these two elements as raw HTML, then close the document:

1. FOOTER: Professional footer matching the ${style} design style. Includes: business name, nav links (About, Services, Contact), copyright "© ${year} ${lead.business_name}. All rights reserved.", phone "${lead.phone || ''}", address "${lead.address || lead.city}".

2. CLAIM BANNER: A fixed banner (position:fixed; bottom:0; left:0; right:0; z-index:9999) with dark background (#1a1a2e), white text stating "🚀 This is a free demo site built by Evolve Expert Agency." and a gold button "Claim Your Site →" linking to mailto:hello@evolve.agency.

3. After the claim banner, write the closing tags: </body></html>

Return RAW HTML only. The output MUST end with </body></html>.`;

  const html = await callLLM(prompt, 1200, false, process.env.SITE_GEN_PROVIDER as any, process.env.SITE_GEN_MODEL, false, true);
  return html;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function generateSiteHtmlChunked(lead: Lead): Promise<string> {
  const designStyle = lead.design_language || 'corporate';
  // Use up to 4000 chars of style rules — enough to cover the unique layout/component section
  const styleRules = (designLanguages[designStyle] || designLanguages['corporate']).slice(0, 4000);
  const layoutHint = DESIGN_LAYOUT_HINTS[designStyle] || DESIGN_LAYOUT_HINTS['corporate'];

  logger.info(`[ChunkedGen] Starting 4-chunk generation for "${lead.business_name}"`, { style: designStyle });

  const chunkDefs = [
    {
      name: 'chunk1 (Head+Navbar+Hero+TrustBar)',
      fn: () => genChunk1(lead, styleRules, layoutHint),
      validate: (html: string) => validateChunk('chunk1', html, 0),
    },
    {
      name: 'chunk2 (About+Services)',
      fn: () => genChunk2(lead, styleRules, layoutHint),
      validate: (html: string) => validateChunk('chunk2', html, 1),
    },
    {
      name: 'chunk3 (Testimonials+Contact)',
      fn: () => genChunk3(lead, styleRules, layoutHint),
      validate: (html: string) => validateChunk('chunk3', html, 2),
    },
    {
      name: 'chunk4 (Footer+Banner)',
      fn: () => genChunk4(lead),
      validate: (html: string) => validateChunk('chunk4', html, 3),
    },
  ];

  const chunks: string[] = [];

  for (let i = 0; i < chunkDefs.length; i++) {
    const { name, fn, validate } = chunkDefs[i];

    const chunkHtml = await retryChunk(name, async () => {
      const html = await fn();
      validate(html);
      return html;
    });

    chunks.push(chunkHtml.trim());
    logger.info(`[ChunkedGen] ${name} complete — ${chunkHtml.length} chars`);

    if (i < chunkDefs.length - 1) {
      await sleep(INTER_CHUNK_DELAY);
    }
  }

  // ─── Stitch chunks together ───────────────────────────────────────────────
  // Chunk 1: complete document opening (<!DOCTYPE>...<body>...[hero][trustbar])
  // Chunks 2-3: <section> blocks (no document shell)
  // Chunk 4: footer + claim banner + </body></html>

  let fullHtml = chunks[0];

  // Strip any accidental </body></html> endings from chunk 1
  fullHtml = fullHtml.replace(/<\/body\s*>\s*<\/html\s*>/gi, '').trimEnd();

  // Sanitize middle chunks (2 and 3): remove any document-level wrapper tags
  for (let i = 1; i <= 2; i++) {
    let chunk = chunks[i];
    chunk = chunk.replace(/<!DOCTYPE[^>]*>/gi, '');
    chunk = chunk.replace(/<html[^>]*>/gi, '');
    chunk = chunk.replace(/<\/html>/gi, '');
    chunk = chunk.replace(/<head[\s\S]*?<\/head>/gi, '');
    chunk = chunk.replace(/<body[^>]*>/gi, '');
    chunk = chunk.replace(/<\/body>/gi, '');
    fullHtml += '\n' + chunk.trim();
  }

  // Last chunk (footer+banner): only strip *opening* structural wrapper tags,
  // but KEEP the closing </body></html> which belongs at the very end.
  let lastChunk = chunks[3];
  lastChunk = lastChunk.replace(/<!DOCTYPE[^>]*>/gi, '');
  lastChunk = lastChunk.replace(/<html[^>]*>/gi, '');
  lastChunk = lastChunk.replace(/<head[\s\S]*?<\/head>/gi, '');
  lastChunk = lastChunk.replace(/<body[^>]*>/gi, '');
  // Do NOT strip </body></html> here — chunk 4 is supposed to close the document
  fullHtml += '\n' + lastChunk.trim();

  // Safety net: ensure document is always properly closed
  if (!fullHtml.toLowerCase().includes('</html>')) {
    logger.warn('[ChunkedGen] Missing </html> — appending closing tags as safety net');
    fullHtml += '\n</body>\n</html>';
  }

  logger.info(`[ChunkedGen] Complete. Total: ${(fullHtml.length / 1024).toFixed(1)}KB, ${fullHtml.split('\n').length} lines`);
  return fullHtml;
}
