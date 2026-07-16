/**
 * @file HTML sanitizer for AI-generated landing pages.
 * Removes leftover placeholders, React/JSX artifacts, fixes broken image references,
 * and ensures structural completeness before saving or serving.
 */

import type { Lead } from '@acquisition-engine/shared';
import logger from '../../lib/logger.js';

const NICHE_UNSPLASH: Record<string, string> = {
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
  clinic:     'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=80',
  gym:        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
  salon:      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80',
  dentist:    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80',
  lawyer:     'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1600&q=80',
  default:    'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&w=1600&q=80',
};

function getFallbackImage(niche?: string): string {
  if (!niche) return NICHE_UNSPLASH.default;
  const key = Object.keys(NICHE_UNSPLASH).find(k => niche.toLowerCase().includes(k));
  return key ? NICHE_UNSPLASH[key] : NICHE_UNSPLASH.default;
}

/**
 * Clean up AI-generated HTML before saving or serving.
 */
export function sanitizeHtml(html: string, lead: Partial<Lead>): string {
  let out = html;

  // ── 1. Strip markdown fences ────────────────────────────────────────────────
  out = out.replace(/```html?\n?/gi, '').replace(/```/g, '').trim();

  // ── 2. Extract from <!DOCTYPE if there's preamble text ────────────────────
  const docTypeIndex = out.toLowerCase().indexOf('<!doctype html>');
  if (docTypeIndex > 0) {
    out = out.substring(docTypeIndex);
  }

  // ── 3. Replace {{DOUBLE_BRACE}} placeholders (template-style tokens) ───────
  // These can appear when the LLM mirrors the builder.ts token style.
  const doubleBraceReplacements: Record<string, string> = {
    '{{BUSINESS_NAME}}':        lead.business_name || 'Our Business',
    '{{CITY}}':                 lead.city || 'Your City',
    '{{PHONE}}':                lead.phone || '',
    '{{ADDRESS}}':              lead.address || '',
    '{{NICHE}}':                lead.niche || 'services',
    '{{TAGLINE}}':              lead.tagline || 'Premium Local Services',
    '{{HERO_HEADLINE}}':        lead.hero_headline || `Premium ${lead.niche || 'Services'} in ${lead.city || 'Your City'}`,
    '{{HERO_SUBLINE}}':         lead.hero_subline || '',
    '{{CTA_PRIMARY}}':          lead.cta_text || 'Get a Free Quote',
    '{{CTA_SECONDARY}}':        'Learn More',
    '{{LOGO_URL}}':             lead.logo_url || '',
    '{{GOOGLE_RATING}}':        String(lead.google_rating || '4.8'),
    '{{REVIEW_COUNT}}':         String(lead.google_review_count || '120'),
    '{{YEAR}}':                 String(new Date().getFullYear()),
    '{{FROM_EMAIL}}':           process.env.FROM_EMAIL || 'hello@evolveexpert.agency',
  };

  for (const [token, value] of Object.entries(doubleBraceReplacements)) {
    out = out.replaceAll(token, value);
  }

  // Strip any remaining {{UNKNOWN_TOKEN}} patterns
  out = out.replace(/\{\{[A-Z0-9_]+\}\}/g, '');

  // ── 4. Replace {single_brace} placeholders (LLM variable style) ────────────
  const singleBraceReplacements: Record<string, string> = {
    '{business_name}':       lead.business_name || 'Our Business',
    '{city}':                lead.city || 'Your City',
    '{phone}':               lead.phone || '',
    '{address}':             lead.address || '',
    '{niche}':               lead.niche || 'services',
    '{tagline}':             lead.tagline || 'Premium Local Services',
    '{hero_headline}':       lead.hero_headline || `Premium ${lead.niche || 'Services'} in ${lead.city || 'Your City'}`,
    '{hero_subline}':        lead.hero_subline || '',
    '{cta_text}':            lead.cta_text || 'Get a Free Quote',
    '{logo_url}':            lead.logo_url || '',
    '{google_rating}':       String(lead.google_rating || '4.8'),
    '{google_review_count}': String(lead.google_review_count || '120'),
  };

  for (const [placeholder, value] of Object.entries(singleBraceReplacements)) {
    out = out.replaceAll(placeholder, value);
  }

  // Strip any remaining {word} or {word_word} patterns not matched above
  out = out.replace(/\{[a-zA-Z_]+\}/g, '');

  // ── 5. Fix broken/empty image src attributes ────────────────────────────────
  const fallbackImg = getFallbackImage(lead.niche);

  // Fix src="" / src="#" / src="undefined" / src="null" / src="placeholder"
  out = out.replace(/src=["'](\s*|#|placeholder|undefined|null|NaN)["']/gi, `src="${fallbackImg}"`);

  // Fix src="{variable}" or src="{{VARIABLE}}" that slipped through
  out = out.replace(/src=["']\{[^}]+\}["']/gi, `src="${fallbackImg}"`);
  out = out.replace(/src=["']\{\{[^}]+\}\}["']/gi, `src="${fallbackImg}"`);

  // ── 6. Fix broken CSS background-image: url(...) ────────────────────────────
  // Replace url(undefined), url(null), url(#), url(''), url("") etc.
  out = out.replace(
    /background-image\s*:\s*url\(["']?(\s*|undefined|null|#|placeholder)["']?\)/gi,
    `background-image:url('${fallbackImg}')`
  );

  // Replace background-image: url({variable}) or url({{TOKEN}})
  out = out.replace(
    /background-image\s*:\s*url\(["']?\{\{?[^}]+\}?\}["']?\)/gi,
    `background-image:url('${fallbackImg}')`
  );

  // ── 7. Remove React/JSX artifacts ──────────────────────────────────────────
  out = out.replace(/^import .+;?\s*$/gm, '');
  out = out.replace(/^export (default )?/gm, '');
  // Remove JSX .map() patterns
  out = out.replace(/\{[^}]*\.map\([^)]*\)[^}]*\}/g, '');

  // ── 8. Ensure the Claim Banner is present ──────────────────────────────────
  const hasBanner = out.includes('Claim Your Site') || out.includes('claim-banner') || out.includes('evolve.agency');
  if (!hasBanner) {
    const banner = `
  <!-- Claim Banner -->
  <div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:14px;display:flex;align-items:center;justify-content:center;gap:12px;">
    <span>🚀 This is a free demo site built by <strong>Evolve Expert Agency</strong>.</span>
    <a href="mailto:hello@evolve.agency" style="background:#f59e0b;color:#000;padding:6px 14px;border-radius:6px;font-weight:700;text-decoration:none;">Claim Your Site →</a>
  </div>`;
    // Insert before </body>; if no </body>, append to end
    if (out.toLowerCase().includes('</body>')) {
      out = out.replace(/<\/body>/i, `${banner}\n</body>`);
    } else {
      out += `${banner}\n</body>\n</html>`;
    }
  }

  // ── 9. Ensure document closes properly ─────────────────────────────────────
  if (!out.toLowerCase().includes('</html>')) {
    out += '\n</body>\n</html>';
  }

  // ── 10. Log quality metrics ─────────────────────────────────────────────────
  const lineCount = out.split('\n').length;
  const sizeKb = (out.length / 1024).toFixed(1);
  const quality = lineCount < 300 ? 'LOW' : lineCount < 500 ? 'MEDIUM' : 'HIGH';

  logger.info(`[sanitizeHtml] Output: ${lineCount} lines, ${sizeKb}KB — quality: ${quality}`, {
    business: lead.business_name,
  });

  if (quality === 'LOW') {
    logger.warn(`[sanitizeHtml] ⚠️ LOW QUALITY output for ${lead.business_name} — only ${lineCount} lines. Page may be truncated!`);
  }

  return out;
}
