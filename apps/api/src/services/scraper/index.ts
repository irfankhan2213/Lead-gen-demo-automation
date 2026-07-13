/**
 * @file Scraper orchestrator — coordinates all scrapers for a single campaign run.
 * This is the main entry point for the scrape pipeline.
 *
 * Flow:
 *  1. Google Maps search → list of businesses
 *  2. For each business in parallel: website + Reddit + Yelp
 *  3. Merge all data into a LeadData object
 *  4. Save to DB
 *  5. Emit SSE events throughout
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../lib/logger.js';
import { createSSELogger } from '../../lib/sse.js';
import { createLead, updateLeadAIAnalysis, updateLeadDemo, incrementCampaignCounter } from '../../db/queries.js';
import { discoverBusinesses } from './discovery.js';
import { scrapeBusinessWebsite } from './website.js';
import { scrapeRedditMentions } from './reddit.js';
import { scrapeYelpReviews } from './yelp.js';
import { scrapeInstagramProfile } from './instagram.js';
import { chromium, Browser, BrowserContext } from 'playwright';
import { callLLM } from '../ai/client.js';
import { analyzesBusiness } from '../ai/analyzesBusiness.js';
import { generateQueue } from '../../lib/queue.js';
import { updateCampaignStatus } from '../../db/queries.js';
import type {
  ScrapeInput,
  LeadData,
  GoogleMapsBusiness,
  WebsiteScrapedData,
} from '@acquisition-engine/shared';

/** Converts first letter of each word to uppercase */
function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

async function verifyLeadTarget(niche: string, websiteData: WebsiteScrapedData, rawName: string): Promise<{ is_valid: boolean; reason: string }> {
  const contentToAnalyze = `
Name: ${rawName}
Tagline: ${websiteData.tagline || 'None'}
About: ${websiteData.about_text || 'None'}
Services: ${websiteData.services?.join(', ') || 'None'}
  `.trim();

  if (contentToAnalyze.length < 50) {
    // Not enough data to verify, assume true to not drop good leads with bad scrapes
    return { is_valid: true, reason: 'Insufficient scrape data to verify.' };
  }

  const prompt = `You are a strict lead verification gatekeeper.
The user is looking for businesses matching this niche: "${niche}".
Here is the extracted content from a potential lead's website:
---
${contentToAnalyze}
---
Does this company actually operate in or closely match the requested niche?
Reject (is_valid: false) if this is clearly a directory (like Yelp, Clutch), a news article, a listicle, or completely irrelevant.

Return ONLY valid JSON:
{
  "is_valid": boolean,
  "reason": "short explanation"
}`;

  try {
    const response = await callLLM(prompt, 300, true);
    const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    return { is_valid: !!result.is_valid, reason: result.reason || '' };
  } catch (err) {
    logger.warn('AI Lead Verification failed, defaulting to valid', { error: (err as Error).message });
    return { is_valid: true, reason: 'Verification failed' };
  }
}

/**
 * Orchestrates a full business profile scrape for a niche + city.
 * Emits real-time SSE events to the dashboard.
 *
 * @param input - Scrape job input including jobId, niche, city
 */
export async function scrapeFullBusinessProfile(input: ScrapeInput): Promise<void> {
  const log = createSSELogger(input.jobId);

  const niche = input.niche.trim();
  const city = toTitleCase(input.city.trim());
  const campaignId = input.campaignId;

  log.log(`🔍 Searching Google Maps for "${niche}" in "${city}"...`);

  let savedLeadsCount = 0;
  const limit = input.limit === 'unlimited' ? 9999 : (input.limit ?? 20);
  let processedRawCount = 0;

  // Initialize shared browser pool for the entire campaign scrape
  log.log('🚀 Initializing shared browser pool for deep scraping...');
  let browser: Browser | undefined;
  let sharedContext: BrowserContext | undefined;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    sharedContext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
  } catch (err) {
    log.error(`❌ Failed to initialize browser pool: ${(err as Error).message}`);
    return;
  }

  try {
    // Process each business sequentially to respect rate limits
    for await (const business of discoverBusinesses(niche, city, 'unlimited')) {
      if (savedLeadsCount >= limit) {
        log.log(`🎯 Reached target limit of ${limit} filtered leads. Stopping.`);
        break;
      }
      
      processedRawCount++;
      log.log(`📋 Processing [${processedRawCount}]: ${business.name} (Saved: ${savedLeadsCount}/${limit})`);

      try {
      // Run enrichment scrapers in parallel
      const [websiteResult, redditResult, yelpResult, igResult] = await Promise.allSettled([
        business.website_url
          ? scrapeBusinessWebsite(business.website_url, sharedContext)
          : Promise.resolve<WebsiteScrapedData>({}),
        scrapeRedditMentions(business.name, city),
        scrapeYelpReviews(business.name, city, sharedContext),
        scrapeInstagramProfile(
          typeof business === 'object' && 'social_links' in business
            ? (business as GoogleMapsBusiness & { social_links?: { instagram?: string } }).social_links?.instagram || ''
            : '',
          sharedContext
        ),
      ]);

      const websiteData = websiteResult.status === 'fulfilled' ? websiteResult.value : {};
      const redditData = redditResult.status === 'fulfilled' ? redditResult.value : [];
      const yelpData = yelpResult.status === 'fulfilled' ? yelpResult.value : '';
      const igData = igResult.status === 'fulfilled' ? igResult.value : {};

      // ─── AI Gatekeeper: Verify Lead Target ─────────────────────────────
      log.log(`🧠 Verifying if ${business.name} matches target niche...`);
      const verification = await verifyLeadTarget(niche, websiteData, business.name);
      if (!verification.is_valid) {
        log.warn(`🚫 AI Rejected ${business.name}: ${verification.reason}`);
        continue;
      }
      log.success(`✅ AI Verified ${business.name}: ${verification.reason}`);

      // ─── Quality Gate: EMAIL OR PHONE REQUIRED ────────────────────────────
      const finalPhone = websiteData.phone || business.phone || undefined;
      const finalEmail = websiteData.email || undefined;

      if (!finalEmail && !finalPhone) {
        log.warn(`⏭️ Skipping ${business.name} — No contact info (email or phone) found.`);
        continue;
      }

      // Merge all scraped data
      const leadData: LeadData = {
        campaign_id: campaignId,
        niche,
        city,
        business_name: business.name,
        address: business.address,
        // Phone: prefer website (has tel: link) → Google Maps detail page
        phone: finalPhone,
        // Email: from website scraper (mailto or contact page)
        email: finalEmail,
        website_url: business.website_url,
        google_maps_url: business.google_maps_url,
        google_rating: business.google_rating,
        google_review_count: business.google_review_count,
        hero_image_url: business.hero_image_url,
        demo_mode: input.demo_mode ?? 'ai_scratch',
        // From website scraper
        brand_colors: websiteData.brand_colors,
        brand_fonts: websiteData.brand_fonts,
        tagline: websiteData.tagline,
        about_text: websiteData.about_text,
        services: websiteData.services,
        menu_or_pricing: websiteData.menu_or_pricing,
        social_links: websiteData.social_links,
        logo_url: websiteData.logo_url,
        scraped_images: websiteData.images,
        // From other scrapers
        reddit_mentions: redditData,
        yelp_reviews_summary: yelpData || undefined,
        instagram_bio: igData.bio,
        instagram_post_themes: igData.post_themes,
      };

      // Save to database
      const lead = await createLead(leadData);
      log.success(`💾 Saved: ${business.name} (ID: ${lead.id})`, { leadId: lead.id });

      // Increment campaign counter
      if (campaignId) {
        await incrementCampaignCounter(campaignId, 'leads_count').catch(() => {});
      }

      // Increment saved count
      savedLeadsCount++;

      // Run AI analysis immediately
      log.log(`🤖 Running AI analysis for ${business.name}...`);
      try {
        const analysis = await analyzesBusiness(leadData);
        await updateLeadAIAnalysis(lead.id, analysis);
        log.success(`✨ AI score: ${analysis.opportunity_score}/10 — ${analysis.opportunity_reason}`);

        // Auto-queue demo generation for EVERY saved lead
        const genJobId = uuidv4();
        await generateQueue.add('generate-demo' as any, {
          jobId: genJobId,
          leadId: lead.id,
          demo_mode: input.demo_mode ?? 'ai_scratch',
        });
        log.log(`📋 Queued for demo generation (score: ${analysis.opportunity_score}/10)`);
      } catch (aiErr) {
        log.warn(`⚠️ AI analysis skipped: ${(aiErr as Error).message}`);
      }

      // Delay between businesses to be respectful to servers
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
    } catch (err) {
      log.error(`❌ Failed to process ${business.name}: ${(err as Error).message}`);
      logger.error('Scrape orchestrator error', { business: business.name, error: (err as Error).stack });
    }
  }
  } catch (err) {
    log.error(`❌ Scraping loop failed: ${(err as Error).message}`);
    if (campaignId) {
      await updateCampaignStatus(campaignId, 'failed').catch(() => {});
    }
  } finally {
    // Cleanup shared browser pool
    try {
      if (sharedContext) await sharedContext.close();
      if (browser) await browser.close();
      log.log('🧹 Cleaned up browser pool.');
    } catch (err) {
      logger.error('Failed to cleanup browser pool', { error: (err as Error).message });
    }
  }

  if (campaignId) {
    await updateCampaignStatus(campaignId, 'completed').catch(() => {});
  }

  log.success(`🎉 Campaign scrape complete! Saved ${savedLeadsCount} filtered businesses (from ${processedRawCount} raw results).`);
}
