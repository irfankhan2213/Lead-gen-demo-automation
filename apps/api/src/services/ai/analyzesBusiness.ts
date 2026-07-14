/**
 * @file AI business analysis using Claude claude-sonnet-4-6.
 * Extracts brand DNA, identifies pain points, scores opportunity,
 * and recommends a template type for demo generation.
 *
 * @param businessData - Merged scraped data for the business
 * @returns AIAnalysis object with all structured outputs
 */

import { callLLM } from './client.js';
import logger from '../../lib/logger.js';
import type { LeadData, AIAnalysis } from '@acquisition-engine/shared';

import { jsonrepair } from 'jsonrepair';

/**
 * Calls Claude to analyze a business's brand and opportunity score.
 *
 * @param businessData - All available scraped data for the business
 * @returns Structured AI analysis
 */
export async function analyzesBusiness(businessData: Partial<LeadData>): Promise<AIAnalysis> {
  // Build a focused prompt — exclude very long fields
  const dataForPrompt = {
    business_name: businessData.business_name,
    niche: businessData.niche,
    city: businessData.city,
    google_rating: businessData.google_rating,
    google_review_count: businessData.google_review_count,
    tagline: businessData.tagline,
    about_text: businessData.about_text?.slice(0, 250),
    services: businessData.services?.slice(0, 6),
  };

  const prompt = `Analyze this business for a web design outreach lead:
${JSON.stringify(dataForPrompt, null, 2)}

Return ONLY valid JSON with exactly this structure:
{
  "brand_dna": "2 sentence summary of identity",
  "primary_colors": ["#hex1", "#hex2"],
  "tone": "professional",
  "design_language": "corporate",
  "pain_points": ["weakness 1", "weakness 2", "weakness 3"],
  "opportunity_score": 8,
  "opportunity_reason": "why they need a website",
  "recommended_template": "clinic",
  "hero_headline": "headline for demo site",
  "hero_subline": "subline for demo site",
  "cta_text": "CTA button text",
  "estimated_revenue_potential": "Medium"
}

Constraints:
- TONE: professional | playful | bold | warm | luxury | minimal
- RECOMMENDED_TEMPLATE: restaurant | clinic | gym | salon | generic
- ESTIMATED_REVENUE_POTENTIAL: Low | Medium | High
- DESIGN_LANGUAGE: luxury | swiss | flat | material | claymorphism | neumorphism | industrial | corporate | botanical

Design Style Guide:
- luxury: premium, serif headings, Vogue style
- swiss: typographic grid, bold sans-serif, clinical/tech
- flat: simple blocks, no shadows, consumer services
- material: soft curves, pill buttons, B2C services
- claymorphism: inflatable shapes, creative
- neumorphism: soft shadows, minimalist
- industrial: mechanical, safety-orange, auto/repair/logistics
- corporate: navy/gold trust, serif (lawyers, real estate)
- botanical: terracotta/sage, organic (spas, florists)

Ensure JSON is valid. Escape newlines and quotes.`;

  try {
    const text = await callLLM(prompt, 4000, true);
    console.log('RAW LLM RESPONSE:', text);

    // Parse JSON — strip any markdown code fences if present
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    
    // Repair broken JSON emitted by LLM (unescaped quotes, newlines, etc.)
    const repairedJson = jsonrepair(jsonStr);
    const rawAnalysis = JSON.parse(repairedJson);

    // Defensive parsing: Normalize camelCase keys to snake_case
    const brand_dna = rawAnalysis.brand_dna || rawAnalysis.brandDna || '';
    const primary_colors = rawAnalysis.primary_colors || rawAnalysis.primaryColors || [];
    const tone = rawAnalysis.tone || 'professional';
    const design_language = rawAnalysis.design_language || rawAnalysis.designLanguage || 'corporate';
    const pain_points = rawAnalysis.pain_points || rawAnalysis.painPoints || [];
    
    let rawScore = rawAnalysis.opportunity_score ?? rawAnalysis.opportunityScore ?? rawAnalysis.score;
    if (typeof rawScore === 'string') {
      rawScore = parseInt(rawScore, 10);
    }
    if (typeof rawScore !== 'number' || isNaN(rawScore)) {
      throw new Error(`Invalid AI response: missing opportunity_score (raw payload: ${JSON.stringify(rawAnalysis)})`);
    }

    const opportunity_reason = rawAnalysis.opportunity_reason || rawAnalysis.opportunityReason || '';
    const recommended_template = rawAnalysis.recommended_template || rawAnalysis.recommendedTemplate || 'generic';
    const hero_headline = rawAnalysis.hero_headline || rawAnalysis.heroHeadline || '';
    const hero_subline = rawAnalysis.hero_subline || rawAnalysis.heroSubline || '';
    const cta_text = rawAnalysis.cta_text || rawAnalysis.ctaText || 'Get Started';
    const estimated_revenue_potential = rawAnalysis.estimated_revenue_potential || rawAnalysis.estimatedRevenuePotential || 'Medium';

    // Default design language if invalid
    const validLanguages = ['luxury', 'swiss', 'flat', 'material', 'claymorphism', 'neumorphism', 'industrial', 'corporate', 'botanical'];
    const finalDesignLanguage = validLanguages.includes(design_language) ? design_language : 'corporate';

    const analysis: AIAnalysis = {
      brand_dna,
      primary_colors,
      tone,
      design_language: finalDesignLanguage as any,
      pain_points,
      opportunity_score: rawScore,
      opportunity_reason,
      recommended_template,
      hero_headline,
      hero_subline,
      cta_text,
      estimated_revenue_potential,
    };

    logger.info(`AI analysis complete for ${businessData.business_name}`, {
      score: analysis.opportunity_score,
      tone: analysis.tone,
      template: analysis.recommended_template,
    });

    return analysis;
  } catch (err) {
    logger.error('AI analysis failed', { error: (err as Error).message });
    throw err;
  }
}
