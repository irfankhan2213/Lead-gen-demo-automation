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
import { scrapeGoogleMaps } from './googleMaps.js';
import { scrapeBusinessWebsite } from './website.js';
import { scrapeRedditMentions } from './reddit.js';
import { scrapeYelpReviews } from './yelp.js';
import { scrapeInstagramProfile } from './instagram.js';
import { analyzesBusiness } from '../ai/analyzesBusiness.js';
import { generateQueue } from '../../lib/queue.js';
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

  try {
    // Process each business sequentially to respect rate limits
    for await (const business of scrapeGoogleMaps(niche, city, 'unlimited')) {
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
          ? scrapeBusinessWebsite(business.website_url)
          : Promise.resolve<WebsiteScrapedData>({}),
        scrapeRedditMentions(business.name, city),
        scrapeYelpReviews(business.name, city),
        scrapeInstagramProfile(
          typeof business === 'object' && 'social_links' in business
            ? (business as GoogleMapsBusiness & { social_links?: { instagram?: string } }).social_links?.instagram
            : undefined
        ),
      ]);

      const websiteData = websiteResult.status === 'fulfilled' ? websiteResult.value : {};
      const redditData = redditResult.status === 'fulfilled' ? redditResult.value : [];
      const yelpData = yelpResult.status === 'fulfilled' ? yelpResult.value : '';
      const igData = igResult.status === 'fulfilled' ? igResult.value : {};

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
        demo_mode: input.demo_mode ?? 'template',
        // From website scraper
        brand_colors: websiteData.brand_colors,
        brand_fonts: websiteData.brand_fonts,
        tagline: websiteData.tagline,
        about_text: websiteData.about_text,
        services: websiteData.services,
        menu_or_pricing: websiteData.menu_or_pricing,
        social_links: websiteData.social_links,
        // From other scrapers
        reddit_mentions: redditData,
        yelp_reviews_summary: yelpData || undefined,
        instagram_bio: igData.instagram_bio,
        instagram_post_themes: igData.instagram_post_themes,
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
          demo_mode: input.demo_mode ?? 'template',
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
  }

  log.success(`🎉 Campaign scrape complete! Saved ${savedLeadsCount} filtered businesses (from ${processedRawCount} raw results).`);
}
