/**
 * @file Yelp review scraper using Playwright.
 * Extracts review themes, star breakdown summary, and overall sentiment
 * from a business's Yelp listing.
 *
 * @param businessName - Name of the business
 * @param city - City for location disambiguation
 * @returns A summary string of review themes, or empty string if not found
 */

import { chromium, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../../lib/logger.js';

const delay = (ms = 1500) => new Promise((r) => setTimeout(r, ms + Math.random() * 500));

/**
 * Scrapes Yelp for a business's review summary.
 * @param businessName - Business name to search
 * @param city - City to narrow results
 * @param sharedContext - Optional Playwright BrowserContext
 * @returns Review themes summary string
 */
export async function scrapeYelpReviews(
  businessName: string,
  city: string,
  sharedContext?: BrowserContext
): Promise<string> {
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

    // Search Yelp
    const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(businessName)}&find_loc=${encodeURIComponent(city)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await delay();

    const html = await page.content();
    const $ = cheerio.load(html);

    // Find the first result link
    let businessPageUrl = '';
    $('a[href*="/biz/"]').each((_, el) => {
      if (!businessPageUrl) {
        const href = $(el).attr('href') ?? '';
        if (href.startsWith('/biz/')) {
          businessPageUrl = `https://www.yelp.com${href}`;
        }
      }
    });

    if (!businessPageUrl) {
      logger.warn(`Yelp: no listing found for "${businessName}" in ${city}`);
      return '';
    }

    // Visit the business page
    await page.goto(businessPageUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await delay();

    const bizHtml = await page.content();
    const $biz = cheerio.load(bizHtml);

    // Collect review snippets
    const reviewTexts: string[] = [];
    $biz('p[lang="en"], .comment__373c0__Nsutg, [class*="raw__"]').each((_, el) => {
      const text = $biz(el).text().trim();
      if (text.length > 30) reviewTexts.push(text.slice(0, 200));
    });

    // Overall rating
    const overallRating = $biz('[aria-label*="star rating"]').first().attr('aria-label') ?? '';

    // Compose summary
    const summary = [
      overallRating ? `Overall: ${overallRating}.` : '',
      reviewTexts.slice(0, 5).join(' | '),
    ]
      .filter(Boolean)
      .join(' ');

    logger.info(`Yelp scraped ${reviewTexts.length} reviews for "${businessName}"`);
    return summary.slice(0, 1000);
  } catch (err) {
    logger.warn('Yelp scrape failed', { error: (err as Error).message });
    return '';
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
