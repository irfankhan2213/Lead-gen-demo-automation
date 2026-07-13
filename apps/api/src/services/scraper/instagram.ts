/**
 * @file Instagram public profile scraper.
 * Extracts bio, follower count hints, and post count from a business's
 * public Instagram profile without requiring API credentials.
 *
 * NOTE: Instagram heavily protects against scraping. This implementation
 * uses the public meta tags available before login wall.
 *
 * @param instagramUrl - Full Instagram profile URL
 * @returns Bio and post theme hints
 */

import { chromium, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../../lib/logger.js';

/**
 * Scrapes an Instagram profile for bio and recent post themes.
 * Note: Instagram heavily rate limits and blocks scrapers. This uses a very
 * light touch and bails quickly if blocked.
 *
 * @param instagramUrl - The full Instagram profile URL
 * @param sharedContext - Optional Playwright BrowserContext
 * @returns Object with bio and post_themes if successful
 */
export async function scrapeInstagramProfile(instagramUrl: string, sharedContext?: BrowserContext): Promise<{
  bio?: string;
  post_themes?: string;
}> {
  let browser;
  let context = sharedContext;

  if (!context) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
  }

  try {
    const page = await context.newPage();
    await page.goto(instagramUrl, { waitUntil: 'domcontentloaded', timeout: 8_000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Check if we hit the login wall — if so, bail early
    const url = page.url();
    if (url.includes('/accounts/login') || url.includes('login')) {
      logger.info(`Instagram: login wall detected for ${instagramUrl}, skipping`);
      return {};
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract from meta tags (available before login wall)
    const ogDesc = $('meta[property="og:description"]').attr('content') ?? '';
    const ogTitle = $('meta[property="og:title"]').attr('content') ?? '';

    // og:description format: "X Followers, Y Following, Z Posts — See Instagram photos..."
    // og:title format: "BusinessName (@handle) • Instagram"

    let bio = '';
    // Extract the bio part after the follower counts
    const bioMatch = ogDesc.match(/— (.+)$/);
    if (bioMatch?.[1]) bio = bioMatch[1].trim();

    // Try direct meta description
    const metaDesc = $('meta[name="description"]').attr('content') ?? '';
    if (!bio && metaDesc) bio = metaDesc;

    logger.info(`Instagram scraped: ${instagramUrl}`, { bio: bio.slice(0, 50) });

    return {
      bio: bio.slice(0, 200) || undefined,
      post_themes: ogTitle ? `Profile: ${ogTitle}` : undefined,
    };
  } catch (err) {
    logger.warn(`Instagram scrape failed for ${instagramUrl}`, { error: (err as Error).message });
    return {};
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
