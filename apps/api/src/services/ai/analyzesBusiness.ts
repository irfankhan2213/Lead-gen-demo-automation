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
    website_url: businessData.website_url,
    google_rating: businessData.google_rating,
    google_review_count: businessData.google_review_count,
    address: businessData.address,
    phone: businessData.phone,
    tagline: businessData.tagline,
    about_text: businessData.about_text?.slice(0, 500),
    services: businessData.services?.slice(0, 8),
    brand_colors: businessData.brand_colors?.slice(0, 5),
    brand_fonts: businessData.brand_fonts,
    social_links: businessData.social_links,
    reddit_mentions: businessData.reddit_mentions?.slice(0, 3).map(m => ({
      subreddit: m.subreddit,
      sentiment: m.sentiment,
      text: m.text.slice(0, 150),
    })),
    yelp_reviews_summary: businessData.yelp_reviews_summary?.slice(0, 300),
    instagram_bio: businessData.instagram_bio,
  };

  const prompt = `You are a B2B sales evaluator and digital strategist analyzing a local business for outreach purposes.
A digital agency wants to build this business a free demo website as a cold outreach hook to eventually sell them high-ticket SEO or web design services.

BUSINESS DATA:
${JSON.stringify(dataForPrompt, null, 2)}

Analyze this business and return ONLY valid JSON with exactly this structure — no markdown, no explanation:
{
  "brand_dna": "2-3 sentence brand summary capturing their vibe, audience, and identity",
  "primary_colors": ["#hex1", "#hex2"],
  "tone": "professional",
  "pain_points": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "opportunity_score": 8,
  "opportunity_reason": "one sentence explaining the score — why do they need a better website and are they a profitable lead?",
  "recommended_template": "restaurant",
  "hero_headline": "a powerful, specific headline for their demo site",
  "hero_subline": "supporting line under headline, specific to their business",
  "cta_text": "call to action button text specific to their business",
  "estimated_revenue_potential": "Medium"
}

SCORING GUIDE for opportunity_score (1–10):
- 1–2: Fake/Spam business, extremely low budget, or no clear services — SKIP
- 3–4: Business has a great modern website already, or very low LTV — SKIP
- 5–6: Website exists but has issues, medium LTV — manual review
- 7–10: High LTV (e.g. MedSpa, Lawyers, High-End Services), poor/no website, clearly established business — AUTO-GENERATE DEMO

TONE must be one of: professional | playful | bold | warm | luxury | minimal
RECOMMENDED_TEMPLATE must be one of: restaurant | clinic | gym | salon | generic
ESTIMATED_REVENUE_POTENTIAL must be one of: Low | Medium | High

Be specific with the headline and CTA — reference their actual business name, location, and niche.
CRITICAL: If the business looks like spam, a residential home, or has zero digital footprint indicating they are a real established business, score them very low (1-3) and set revenue potential to Low.
If they are a high-ticket business (e.g. they sell expensive services/products), set revenue potential to High.

CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON, nothing else. No markdown blocks.
- Escape all newlines in the text using \\n. Do not use literal newlines inside the JSON string.
- Escape any quotes using \\".`;

  try {
    const text = await callLLM(prompt, 1024, true);

    // Parse JSON — strip any markdown code fences if present
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(jsonStr) as AIAnalysis;

    // Validate required fields
    if (typeof analysis.opportunity_score !== 'number') {
      throw new Error('Invalid AI response: missing opportunity_score');
    }

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
