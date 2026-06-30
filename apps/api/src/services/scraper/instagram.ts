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

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../../lib/logger.js';

/**
 * Scrapes an Instagram public profile for bio and basic engagement data.
 * @param instagramUrl - e.g. "https://www.instagram.com/businessname"
 * @returns Object with bio and post_themes strings
 */
export async function scrapeInstagramProfile(instagramUrl?: string): Promise<{
  instagram_bio?: string;
  instagram_post_themes?: string;
}> {
  if (!instagramUrl) return {};

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });

  try {
    const page = await context.newPage();
    await page.goto(instagramUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 2000));

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
      instagram_bio: bio.slice(0, 200) || undefined,
      instagram_post_themes: ogTitle ? `Profile: ${ogTitle}` : undefined,
    };
  } catch (err) {
    logger.warn('Instagram scrape failed', { error: (err as Error).message });
    return {};
  } finally {
    await browser.close();
  }
}
