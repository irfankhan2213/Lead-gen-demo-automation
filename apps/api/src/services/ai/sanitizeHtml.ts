/**
 * @file HTML sanitizer for AI-generated landing pages.
 * Removes leftover placeholders, React/JSX artifacts, and ensures structural completeness.
 */

import type { Lead } from '@acquisition-engine/shared';
import logger from '../../lib/logger.js';

const NICHE_UNSPLASH: Record<string, string> = {
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
  clinic: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=80',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
  salon: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80',
  default: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&w=1600&q=80',
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

  // ── 3. Replace curly brace placeholders with real values ──────────────────
  const replacements: Record<string, string> = {
    '{business_name}': lead.business_name || 'Our Business',
    '{city}': lead.city || 'Your City',
    '{phone}': lead.phone || '',
    '{address}': lead.address || '',
    '{niche}': lead.niche || 'services',
    '{tagline}': lead.tagline || 'Premium Local Services',
    '{hero_headline}': lead.hero_headline || `Premium ${lead.niche || 'Services'} in ${lead.city || 'Your City'}`,
    '{hero_subline}': lead.hero_subline || '',
    '{cta_text}': lead.cta_text || 'Get a Free Quote',
    '{logo_url}': lead.logo_url || '',
    '{google_rating}': String(lead.google_rating || '4.8'),
    '{google_review_count}': String(lead.google_review_count || '120'),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    out = out.replaceAll(placeholder, value);
  }

  // ── 4. Remove any remaining {word} or {word_word} placeholders ─────────────
  out = out.replace(/\{[a-zA-Z_]+\}/g, '');

  // ── 5. Fix empty or broken image src attributes ─────────────────────────────
  const fallbackImg = getFallbackImage(lead.niche);
  out = out.replace(/src=["'](\s*|#|placeholder|undefined|null)["']/gi, `src="${fallbackImg}"`);
  out = out.replace(/src=["']\{[^}]+\}["']/gi, `src="${fallbackImg}"`);

  // ── 6. Remove React/JSX artifacts ──────────────────────────────────────────
  // Remove import/export statements that might leak through
  out = out.replace(/^import .+;?\s*$/gm, '');
  out = out.replace(/^export (default )?/gm, '');
  // Remove .map( usage with arrow functions (JSX pattern)
  out = out.replace(/\{[^}]*\.map\([^)]*\)[^}]*\}/g, '');

  // ── 7. Ensure the Claim Banner is present ──────────────────────────────────
  const hasBanner = out.includes('Claim Your Site') || out.includes('claim-banner') || out.includes('evolve.agency');
  if (!hasBanner) {
    const banner = `
  <!-- Claim Banner -->
  <div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:14px;display:flex;align-items:center;justify-content:center;gap:12px;">
    <span>🚀 This is a free demo site built by <strong>Evolve Expert Agency</strong>.</span>
    <a href="mailto:hello@evolve.agency" style="background:#f59e0b;color:#000;padding:6px 14px;border-radius:6px;font-weight:700;text-decoration:none;">Claim Your Site →</a>
  </div>`;
    out = out.replace('</body>', `${banner}\n</body>`);
  }

  // ── 8. Log quality metrics ─────────────────────────────────────────────────
  const lineCount = out.split('\n').length;
  const sizeKb = (out.length / 1024).toFixed(1);
  logger.info(`[sanitizeHtml] Output: ${lineCount} lines, ${sizeKb}KB`, {
    business: lead.business_name,
    quality: lineCount < 100 ? 'LOW' : lineCount < 200 ? 'MEDIUM' : 'HIGH',
  });

  if (lineCount < 100) {
    logger.warn(`[sanitizeHtml] LOW QUALITY output for ${lead.business_name} — only ${lineCount} lines!`);
  }

  return out;
}
