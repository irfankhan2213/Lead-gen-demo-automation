/**
 * @file Demo site builder — injects business data and AI copy into HTML templates.
 * Loads the appropriate template based on AI-recommended niche type,
 * replaces all {{TOKEN}} placeholders with real data, and returns the final HTML.
 *
 * Template tokens replaced:
 *   {{BUSINESS_NAME}}, {{TAGLINE}}, {{META_DESCRIPTION}}, {{CITY}},
 *   {{PRIMARY_COLOR}}, {{ACCENT_COLOR}},
 *   {{HERO_HEADLINE}}, {{HERO_SUBLINE}},
 *   {{CTA_PRIMARY}}, {{CTA_SECONDARY}},
 *   {{NAV_TAGLINE}},
 *   {{ABOUT_HEADING}}, {{ABOUT_PARA_1}}, {{ABOUT_PARA_2}},
 *   {{SERVICES_HEADING}},
 *   {{SERVICE_1_NAME}}, {{SERVICE_1_DESC}}, ...(up to 3)
 *   {{TESTIMONIAL_HEADING}},
 *   {{TESTIMONIAL_1}}, {{TESTIMONIAL_1_AUTHOR}},
 *   {{TESTIMONIAL_2}}, {{TESTIMONIAL_2_AUTHOR}},
 *   {{CTA_SECTION_HEADING}}, {{CTA_SECTION_SUB}},
 *   {{FOOTER_TAGLINE}},
 *   {{ADDRESS}}, {{PHONE}},
 *   {{GOOGLE_RATING}}, {{REVIEW_COUNT}},
 *   {{YEARS_EST}}, {{SERVICE_COUNT}},
 *   {{INITIAL}}, {{YEAR}},
 *   {{GOOGLE_MAPS_EMBED}}, {{FROM_EMAIL}}
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../../lib/logger.js';
import { generateSiteCopy } from '../ai/generateSite.js';
import type { Lead, TemplateType } from '@acquisition-engine/shared';

const TEMPLATES_DIR = join(__dirname, 'templates');

/** Default primary/accent color palettes per template type */
const DEFAULT_COLORS: Record<TemplateType, { primary: string; accent: string }> = {
  restaurant: { primary: '#b45309', accent: '#d4a853' },
  clinic:     { primary: '#0369a1', accent: '#0ea5e9' },
  gym:        { primary: '#dc2626', accent: '#ef4444' },
  salon:      { primary: '#be185d', accent: '#ec4899' },
  generic:    { primary: '#7c3aed', accent: '#8b5cf6' },
};

/** Service emoji icons per template type */
const SERVICE_EMOJIS: Record<TemplateType, string[]> = {
  restaurant: ['🍽️', '🥘', '🍷'],
  clinic:     ['🦷', '🩺', '💊'],
  gym:        ['💪', '🏋️', '🧘'],
  salon:      ['💅', '✂️', '🌸'],
  generic:    ['⭐', '✨', '🌟'],
};

/**
 * Loads a template HTML file by type.
 * Falls back to generic if the specific template is not found.
 * @param type - Template type
 */
function loadTemplate(type: TemplateType): string {
  const filenames: TemplateType[] = [type, 'generic'];
  for (const name of filenames) {
    try {
      return readFileSync(join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
    } catch { /* try next */ }
  }
  throw new Error(`No template found for type: ${type}`);
}

/**
 * Builds a complete demo HTML page for a lead.
 * Loads the template, generates AI copy, and replaces all tokens.
 *
 * @param lead - Full lead data including AI analysis
 * @returns Complete HTML string ready for deployment
 */
export async function buildDemoSite(lead: Lead): Promise<string> {
  const template = (lead.recommended_template ?? 'generic') as TemplateType;
  logger.info(`Building demo for ${lead.business_name} using template: ${template}`);

  // Load base HTML template
  let html = loadTemplate(template);

  // Get color palette
  const defaultColors = DEFAULT_COLORS[template] ?? DEFAULT_COLORS.generic;
  const brandColors = Array.isArray(lead.brand_colors) ? lead.brand_colors : [];
  const primaryColor = brandColors[0] ?? defaultColors.primary;
  const accentColor = brandColors[1] ?? defaultColors.accent;

  // Generate AI copy
  let copy: Record<string, string> = {};
  try {
    copy = await generateSiteCopy(lead);
  } catch (err) {
    logger.warn(`AI copy generation failed, using defaults: ${(err as Error).message}`);
  }

  // Build services array
  const services = Array.isArray(lead.services) ? lead.services : [];
  const serviceEmojis = SERVICE_EMOJIS[template] ?? SERVICE_EMOJIS.generic;

  // Build Google Maps embed URL
  const mapsQuery = encodeURIComponent(`${lead.business_name ?? ''} ${lead.address ?? lead.city}`);
  const mapsEmbed = `https://www.google.com/maps/embed/v1/place?key=YOUR_KEY&q=${mapsQuery}`;

  // Replacement map
  const tokens: Record<string, string> = {
    '{{BUSINESS_NAME}}':         lead.business_name ?? 'Local Business',
    '{{TAGLINE}}':               lead.tagline ?? copy.hero_headline ?? 'Welcome',
    '{{META_DESCRIPTION}}':      lead.tagline ?? copy.about_para_1?.slice(0, 155) ?? `${lead.business_name} in ${lead.city}`,
    '{{CITY}}':                  lead.city ?? '',
    '{{PRIMARY_COLOR}}':         primaryColor,
    '{{ACCENT_COLOR}}':          accentColor,
    '{{HERO_HEADLINE}}':         copy.hero_headline ?? lead.hero_headline ?? `Welcome to ${lead.business_name}`,
    '{{HERO_SUBLINE}}':          copy.hero_subline ?? lead.hero_subline ?? `Proudly serving ${lead.city}`,
    '{{CTA_PRIMARY}}':           copy.cta_primary ?? lead.cta_text ?? 'Book Now',
    '{{CTA_SECONDARY}}':         copy.cta_secondary ?? 'Learn More',
    '{{NAV_TAGLINE}}':           copy.nav_tagline ?? `Serving ${lead.city}`,
    '{{ABOUT_HEADING}}':         copy.about_heading ?? 'About Us',
    '{{ABOUT_PARA_1}}':          copy.about_para_1 ?? lead.about_text?.slice(0, 300) ?? `We are a leading ${lead.niche} in ${lead.city}.`,
    '{{ABOUT_PARA_2}}':          copy.about_para_2 ?? `Proudly serving the ${lead.city} community.`,
    '{{SERVICES_HEADING}}':      copy.services_heading ?? 'Our Services',
    '{{SERVICE_1_NAME}}':        copy.service_1_name ?? services[0] ?? 'Service One',
    '{{SERVICE_1_DESC}}':        copy.service_1_desc ?? 'Professional service tailored to your needs.',
    '{{SERVICE_2_NAME}}':        copy.service_2_name ?? services[1] ?? 'Service Two',
    '{{SERVICE_2_DESC}}':        copy.service_2_desc ?? 'Expert solutions for every client.',
    '{{SERVICE_3_NAME}}':        copy.service_3_name ?? services[2] ?? 'Service Three',
    '{{SERVICE_3_DESC}}':        copy.service_3_desc ?? 'Premium quality you can count on.',
    '{{TESTIMONIAL_HEADING}}':   copy.testimonial_heading ?? 'What Our Customers Say',
    '{{TESTIMONIAL_1}}':         copy.testimonial_1 ?? 'Absolutely fantastic experience. Highly recommend!',
    '{{TESTIMONIAL_1_AUTHOR}}':  copy.testimonial_1_author ?? `A. R., ${lead.city}`,
    '{{TESTIMONIAL_2}}':         copy.testimonial_2 ?? 'Best in the city. I always come back.',
    '{{TESTIMONIAL_2_AUTHOR}}':  copy.testimonial_2_author ?? `S. M., ${lead.city}`,
    '{{CTA_SECTION_HEADING}}':   copy.cta_section_heading ?? 'Ready to Get Started?',
    '{{CTA_SECTION_SUB}}':       copy.cta_section_sub ?? `We're here to help you every step of the way.`,
    '{{FOOTER_TAGLINE}}':        copy.footer_tagline ?? `Serving ${lead.city} with pride.`,
    '{{ADDRESS}}':               lead.address ?? lead.city ?? '',
    '{{PHONE}}':                 lead.phone ?? 'Call us for details',
    '{{GOOGLE_RATING}}':         String(lead.google_rating ?? '4.5'),
    '{{REVIEW_COUNT}}':          String(lead.google_review_count ?? 50),
    '{{YEARS_EST}}':             '10+',
    '{{SERVICE_COUNT}}':         String(Math.max(services.length, 3)),
    '{{INITIAL}}':               (lead.business_name ?? 'B').charAt(0).toUpperCase(),
    '{{YEAR}}':                  String(new Date().getFullYear()),
    '{{GOOGLE_MAPS_EMBED}}':     mapsEmbed,
    '{{FROM_EMAIL}}':            process.env.FROM_EMAIL ?? 'hello@evolveexpert.agency',
  };

  // Replace all tokens in the HTML
  for (const [token, value] of Object.entries(tokens)) {
    html = html.replaceAll(token, value);
  }

  logger.info(`Demo built successfully for ${lead.business_name}`, {
    template,
    htmlSize: `${Math.round(html.length / 1024)}KB`,
  });

  return html;
}
