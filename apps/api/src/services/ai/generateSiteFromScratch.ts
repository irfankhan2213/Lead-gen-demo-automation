import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';

export async function generateSiteHtmlFromScratch(lead: Lead): Promise<string> {
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
Hero Image URL: ${lead.hero_image_url || 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?auto=format&fit=crop&q=80&w=1600'}

CRITICAL DESIGN REQUIREMENTS (LIKE A PREMIUM WEBFLOW THEME):
1. **Hero Section:** Must use the Hero Image URL as a background with a sleek dark overlay (e.g., bg-black/60). Use a massive, bold typography style for the headline (e.g., text-6xl md:text-8xl font-extrabold tracking-tighter). Include a glassmorphism floating badge and a prominent primary CTA button with hover effects.
2. **Typography & Colors:** Use modern Google Fonts (e.g., 'Inter' or 'Plus Jakarta Sans'). Extract and use the provided Brand Colors via Tailwind arbitrary values (e.g., bg-[${lead.brand_colors?.[0] || '#2563eb'}]).
3. **Structure & Layout:**
   - **Navbar:** Sticky, glassmorphism backdrop (backdrop-blur-md bg-white/80 or black/80), with logo and a 'Contact' CTA.
   - **Trust Bar:** A section below the hero showing "Trusted by 500+ locals in ${lead.city}" with 5-star icons.
   - **About Section:** Split layout (grid grid-cols-1 md:grid-cols-2). Text on one side, and a beautiful overlapping image composition on the other side.
   - **Services Section:** A CSS Grid layout with beautiful cards. Use hover micro-interactions (e.g., hover:-translate-y-2 hover:shadow-2xl transition-all duration-300).
   - **Contact/Footer:** A dark, sleek footer area with phone number, address, and a contact form mockup.
4. **CSS Features:** Heavily utilize rounded corners (rounded-2xl or rounded-3xl), subtle borders (border border-white/10), soft box-shadows, and gradients.
5. **Output Constraints:** Return ONLY the raw HTML string starting with "<!DOCTYPE html>". No markdown formatting, no explanations.

START YOUR RESPONSE WITH "<!DOCTYPE html>".`;

  try {
    const text = await callLLM(prompt, 5000, false);
    // Strip markdown code fences if Claude includes them despite instructions
    let html = text.replace(/```html?\n?/ig, '').replace(/```/g, '').trim();
    
    // Sometimes the LLM includes preamble text before the HTML
    const docTypeIndex = html.toLowerCase().indexOf('<!doctype html>');
    if (docTypeIndex > 0) {
      html = html.substring(docTypeIndex);
    }
    
    return html;
  } catch (err) {
    logger.error('AI from-scratch generation failed', { error: (err as Error).message });
    throw err;
  }
}
