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
import { generateSiteHtmlFromScratch } from '../ai/generateSiteFromScratch.js';
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
  if (lead.demo_mode === 'ai_scratch') {
    logger.info(`Building demo for ${lead.business_name} using AI From Scratch mode`);
    const html = await generateSiteHtmlFromScratch(lead);
    logger.info(`AI demo built successfully for ${lead.business_name}`, {
      htmlSize: `${Math.round(html.length / 1024)}KB`,
    });
    return html;
  }

  const template = (lead.recommended_template ?? 'generic') as TemplateType;
  logger.info(`Building demo for ${lead.business_name} using template: ${template}`);

  // Load base HTML template
  let html = loadTemplate(template);

  // Inject design language style overrides
  const designLanguage = lead.design_language || 'corporate';
  const overrides = getDesignLanguageStyleOverrides(designLanguage);
  html = html.replace('</head>', `${overrides}\n</head>`);

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
  const mapsEmbed = `https://maps.google.com/maps?q=${mapsQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

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
    '{{HERO_IMAGE_URL}}':        lead.hero_image_url ?? 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&q=80&w=1600',
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

function getDesignLanguageStyleOverrides(language: string): string {
  const BUTTONS = `button, input[type="submit"], input[type="button"], .btn, .btn-primary, .btn-outline, .nav-cta, .reserve-btn, .book-btn, .submit-btn, .cta-gold, .cta-ghost, .cta-btn, .action-btn`;
  const CARDS = `.card, .service-card, .testimonial-card, .stats-bar, .about-img-wrapper, .about-img, .cta-inner, .form-card, .tcard, .menu-item, .info-block, .feature-card, .pricing-card, .service-icon, .author-avatar, .awards-inner, .photo-wrapper, .awards`;
  const HEADINGS = `h1, h2, h3, h4, h5, h6, .serif, .logo, .nav-logo, .menu-item-name, .tcard-text, .stat-value, .hero-pre, .award-label, .bold-heading`;

  const overrides: Record<string, string> = {
    luxury: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
        :root {
          --bg: #F9F8F6;
          --card-bg: #F9F8F6;
          --text: #1A1A1A;
          --text-light: #6C6863;
          --border: rgba(26, 26, 26, 0.15);
          --primary: #1A1A1A;
          --accent: #D4AF37;
        }
        body {
          font-family: 'Inter', sans-serif !important;
          background-color: #F9F8F6 !important;
          color: #1A1A1A !important;
        }
        ${HEADINGS} {
          font-family: 'Playfair Display', serif !important;
        }
        ${CARDS}, ${BUTTONS}, input {
          border-radius: 0px !important;
        }
        img {
          filter: grayscale(100%);
          transition: filter 1.5s ease-out, transform 1.5s ease-out !important;
        }
        img:hover {
          filter: grayscale(0%) !important;
          transform: scale(1.03) !important;
        }
      </style>
    `,
    swiss: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        :root {
          --bg: #FFFFFF;
          --card-bg: #F2F2F2;
          --text: #000000;
          --text-light: #666666;
          --border: #000000;
          --primary: #000000;
          --accent: #FF3000;
        }
        body {
          font-family: 'Inter', sans-serif !important;
          background-color: #FFFFFF !important;
          color: #000000 !important;
          background-image: radial-gradient(rgba(0,0,0,0.08) 1px, transparent 0);
          background-size: 24px 24px;
        }
        ${HEADINGS}, ${BUTTONS} {
          font-family: 'Inter', sans-serif !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
        }
        ${CARDS}, ${BUTTONS}, input {
          border-radius: 0px !important;
          border-width: 2px !important;
          border-color: #000000 !important;
          box-shadow: none !important;
        }
        .nav-cta, .reserve-btn, .btn-primary, .cta-gold {
          background-color: #FF3000 !important;
          color: #FFFFFF !important;
          border-color: #000000 !important;
        }
      </style>
    `,
    flat: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&display=swap');
        :root {
          --bg: #FFFFFF;
          --card-bg: #F3F4F6;
          --text: #111827;
          --text-light: #4B5563;
          --border: #E5E7EB;
          --primary: #3B82F6;
          --accent: #10B981;
        }
        body {
          font-family: 'Outfit', sans-serif !important;
          background-color: #FFFFFF !important;
          color: #111827 !important;
        }
        ${HEADINGS} {
          font-family: 'Outfit', sans-serif !important;
          font-weight: 800 !important;
        }
        ${CARDS}, ${BUTTONS}, input {
          border-radius: 8px !important;
          box-shadow: none !important;
          border: none !important;
        }
        ${CARDS} {
          background-color: #F3F4F6 !important;
        }
      </style>
    `,
    material: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        :root {
          --bg: #FFFBFE;
          --card-bg: #F3EDF7;
          --text: #1C1B1F;
          --text-light: #49454F;
          --border: #79747E;
          --primary: #6750A4;
          --accent: #7D5260;
        }
        body {
          font-family: 'Roboto', sans-serif !important;
          background-color: #FFFBFE !important;
          color: #1C1B1F !important;
        }
        ${HEADINGS} {
          font-family: 'Roboto', sans-serif !important;
          font-weight: 500 !important;
        }
        ${BUTTONS} {
          border-radius: 9999px !important;
        }
        ${CARDS} {
          border-radius: 24px !important;
          background-color: #F3EDF7 !important;
        }
        input {
          border-radius: 12px 12px 0 0 !important;
          border-bottom: 2px solid #79747E !important;
        }
      </style>
    `,
    claymorphism: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;700&display=swap');
        :root {
          --bg: #F4F1FA;
          --card-bg: #FFFFFF;
          --text: #332F3A;
          --text-light: #635F69;
          --border: transparent;
          --primary: #7C3AED;
          --accent: #DB2777;
        }
        body {
          font-family: 'DM Sans', sans-serif !important;
          background-color: #F4F1FA !important;
          color: #332F3A !important;
        }
        ${HEADINGS} {
          font-family: 'Nunito', sans-serif !important;
          font-weight: 900 !important;
        }
        ${BUTTONS} {
          border-radius: 20px !important;
          box-shadow: 12px 12px 24px rgba(124, 58, 237, 0.2) !important;
          background: linear-gradient(to bottom right, #A78BFA, #7C3AED) !important;
          color: #fff !important;
          border: none !important;
        }
        ${CARDS} {
          border-radius: 32px !important;
          box-shadow: 16px 16px 32px rgba(160, 150, 180, 0.15) !important;
          background-color: #ffffff !important;
          border: none !important;
        }
        input {
          border-radius: 20px !important;
          box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.05) !important;
          background-color: #EFEBF5 !important;
          border: none !important;
        }
      </style>
    `,
    neumorphism: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700&family=Inter:wght@400;500&display=swap');
        :root {
          --bg: #E0E0E0;
          --card-bg: #E0E0E0;
          --text: #2D3748;
          --text-light: #4A5568;
          --border: transparent;
          --primary: #4A5568;
          --accent: #4A5568;
        }
        body {
          font-family: 'Inter', sans-serif !important;
          background-color: #E0E0E0 !important;
          color: #2D3748 !important;
        }
        ${HEADINGS} {
          font-family: 'Outfit', sans-serif !important;
        }
        ${CARDS} {
          border-radius: 20px !important;
          background: #E0E0E0 !important;
          box-shadow: 9px 9px 16px #bebebe, -9px -9px 16px #ffffff !important;
          border: none !important;
        }
        ${BUTTONS} {
          border-radius: 12px !important;
          background: #E0E0E0 !important;
          box-shadow: 5px 5px 10px #bebebe, -5px -5px 10px #ffffff !important;
          color: #2D3748 !important;
          border: none !important;
        }
        ${BUTTONS}:active {
          box-shadow: inset 5px 5px 10px #bebebe, inset -5px -5px 10px #ffffff !important;
        }
      </style>
    `,
    industrial: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        :root {
          --bg: #121212;
          --card-bg: #1E1E1E;
          --text: #FFFFFF;
          --text-light: #AAAAAA;
          --border: #333333;
          --primary: #FF6600;
          --accent: #FF6600;
        }
        body {
          font-family: 'Space Mono', monospace !important;
          background-color: #121212 !important;
          color: #FFFFFF !important;
        }
        ${HEADINGS} {
          font-family: 'Space Mono', monospace !important;
          font-weight: 700 !important;
        }
        ${CARDS}, ${BUTTONS}, input {
          border-radius: 0px !important;
          border: 1px solid #333333 !important;
        }
        .nav-cta, .reserve-btn, .btn-primary, .cta-gold {
          background-color: #FF6600 !important;
          color: #000000 !important;
          border-color: #FF6600 !important;
        }
      </style>
    `,
    corporate: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap');
        :root {
          --bg: #FFFFFF;
          --card-bg: #F7FAFC;
          --text: #1A202C;
          --text-light: #4A5568;
          --border: #E2E8F0;
          --primary: #1A365D;
          --accent: #D69E2E;
        }
        body {
          font-family: 'Inter', sans-serif !important;
          background-color: #FFFFFF !important;
          color: #1A202C !important;
        }
        ${HEADINGS} {
          font-family: 'Playfair Display', serif !important;
        }
        ${CARDS} {
          border-radius: 4px !important;
          border: 1px solid #E2E8F0 !important;
        }
        ${BUTTONS} {
          border-radius: 4px !important;
          background-color: #1A365D !important;
          color: #FFFFFF !important;
        }
      </style>
    `,
    botanical: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;500;700&display=swap');
        :root {
          --bg: #F2EFE9;
          --card-bg: #E5E0D8;
          --text: #2C3E2C;
          --text-light: #5A6E5A;
          --border: #D8D1C5;
          --primary: #3F5E4D;
          --accent: #C88A58;
        }
        body {
          font-family: 'DM Sans', sans-serif !important;
          background-color: #F2EFE9 !important;
          color: #2C3E2C !important;
        }
        ${HEADINGS} {
          font-family: 'Playfair Display', serif !important;
          color: #2C3E2C !important;
        }
        ${CARDS} {
          border-radius: 16px !important;
          background-color: #E5E0D8 !important;
          border: none !important;
        }
        ${BUTTONS} {
          border-radius: 30px !important;
          background-color: #3F5E4D !important;
          color: #FFFFFF !important;
          border: none !important;
        }
      </style>
    `
  };
  return overrides[language] || overrides['corporate'];
}
