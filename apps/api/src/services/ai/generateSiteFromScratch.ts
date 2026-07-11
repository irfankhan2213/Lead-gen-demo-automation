import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';

export async function generateSiteHtmlFromScratch(lead: Lead): Promise<string> {
  const prompt = `You are an expert web developer and high-converting landing page designer.
Your task is to write the COMPLETE, single-file HTML code for a modern, beautiful landing page for a local business.
You must use Tailwind CSS via CDN. Do not use any external CSS files.

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
Hero Image URL: ${lead.hero_image_url || \`https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&q=80&w=1600\`}

REQUIREMENTS:
1. Return ONLY the raw HTML string. No markdown formatting (\`\`\`html), no explanations.
2. Include <script src="https://cdn.tailwindcss.com"></script> in the head.
3. The page MUST have:
   - A beautiful Hero section with a background image (use the Hero Image URL) with a dark overlay, prominent headline, and a clear Call-to-Action button.
   - An "About Us" section.
   - A "Services" section featuring grid cards.
   - A Footer with contact info (Phone, Address).
4. Use the Brand Colors provided (if available) for buttons and accents using Tailwind arbitrary values (e.g., bg-[${lead.brand_colors?.[0] || '#2563eb'}]).
5. The design must look extremely premium, modern, and mobile-responsive.

START YOUR RESPONSE WITH "<!DOCTYPE html>".`;

  try {
    const text = await callLLM(prompt, 3000, false);
    // Strip markdown code fences if Claude includes them despite instructions
    const html = text.replace(/```html?\n?/ig, '').replace(/```/g, '').trim();
    return html;
  } catch (err) {
    logger.error('AI from-scratch generation failed', { error: (err as Error).message });
    throw err;
  }
}
