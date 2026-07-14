import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { Lead } from '@acquisition-engine/shared';
import { designLanguages } from './prompts/designLanguages.js';

export async function generateSiteHtmlFromScratch(lead: Lead): Promise<string> {
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
1. If a "Logo URL" is provided above, you MUST use it as the '<img>' src for the navigation bar and footer logo to make it authentic (with appropriate height constraint like 'h-10' or 'h-12').
2. If "Scraped Website Images" are provided above, you MUST prioritize using these actual image URLs for the hero background, service/product cards, testimonial avatars, and gallery layout to display the business's real photos. Do not use generic Unsplash URLs if these are available!
3. If no "Scraped Website Images" are available or if you need additional photos, use niche-specific, high-quality Unsplash image URLs.

HTML CODING CONSTRAINTS (CRITICAL):
1. **NO REACT OR JSX:** Do NOT use React, Vue, JSX, or ES6 template string evaluations in the HTML. Do NOT write javascript mapping loops (e.g. 'services.map(...)') or use React braces '{service}' or '{service_name}'.
2. **WRITE FULL STATIC HTML:** Write out the full HTML structure for every element manually. For the Services Section, write out exactly 3-4 separate, individual service card HTML blocks (each with its own icon, unique title, and description based on the business's services: ${(lead.services || []).join(', ')}).
3. **USE ACTUAL CONTENT:** Replace all placeholders with actual text. Do NOT leave things like '{service_title}', '{phone}', or '{address}' in the output. If data is missing, write a realistic, niche-appropriate fallback value.
4. **VALID IMG SRCs:** Ensure all image 'src' attributes contain valid, absolute URLs. Do NOT write placeholder values like 'src="{logo_url}"' or 'src="hero.jpg"'. Use the exact URLs provided in the business data or high-quality Unsplash links.
5. **LENGTH AND DETAIL (CRITICAL):** The landing page MUST be a fully fleshed-out, comprehensive, long-form landing page. The output HTML MUST contain at least 250 to 450 lines of code. Write deep marketing copywriting, detailed descriptions for each section/card, and multiple interactive hover styles. DO NOT abbreviate, truncate, or leave '<!-- Rest of content -->' comments in the HTML.

DESIGN SYSTEM INSTRUCTIONS (${designStyle.toUpperCase()} STYLE):
${styleRules}

PRE-BUILT TEMPLATE STRUCTURE:
Your output HTML MUST follow this structural skeleton exactly:
1. **Navbar**: Sticky navigation bar. Includes logo (business name), links to sections (About, Services, Testimonials, Contact), and a prominent CTA button.
2. **Hero Section**: Large impact section. Incorporates the Hero Image URL, business name, main headline (${lead.hero_headline || lead.tagline || 'Premium Services'}), supporting subline (${lead.hero_subline || ''}), and CTA buttons.
3. **Stats / Trust Bar**: Immediately below Hero. Displays Google Rating (${lead.google_rating || '4.8'} ⭐), customer/review count (${lead.google_review_count || '120'}+ happy locals), and years serving ${lead.city} or similar local trust signals.
4. **About Section**: Multi-column layout. One column with about copy (brand DNA, owner background, mission) and another with a beautiful layout containing an image mockup (or stylized shape).
5. **Services Section**: Grid of service cards showing details of the offered services: ${(lead.services || []).join(', ')}. Card layout should utilize the design style's card tokens.
6. **Testimonials/Reviews Section**: Grids or cards containing 2-3 reviews showcasing social proof.
7. **Contact / Form Section**: Split layout. One side shows location/address (${lead.address || ''}) and phone (${lead.phone || ''}) in a beautiful stylized list. The other side is an interactive contact form (Name, Email, Phone, Message) with a stylized submit button.
8. **Footer**: Clean footer containing business name, footer navigation, copyright, and standard branding.
9. **Claim Banner**: A fixed banner at the bottom stating "This is a free demo site built by Evolve Expert Agency. [Claim Your Site →]" which links to mailto:hello@evolve.agency.

OUTPUT CONSTRAINTS:
- Return ONLY the raw HTML string starting with "<!DOCTYPE html>". No markdown formatting, no explanations.
- Ensure all Tailwind classes used match the ${designStyle.toUpperCase()} design system specifications above.
- Make the page look extremely premium, complete, and polished.

START YOUR RESPONSE WITH "<!DOCTYPE html>".`;

  try {
    const text = await callLLM(prompt, 5000, false, 'groq');
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
