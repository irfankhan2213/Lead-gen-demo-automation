/**
 * @file Google Maps scraper using Playwright headless browser.
 * Searches for businesses on Google Maps and extracts structured data.
 * Falls back to organic Google search results if Maps is inaccessible.
 *
 * @param niche - Business category (e.g. "dentist", "restaurant")
 * @param city - City to search in (e.g. "Austin TX")
 * @returns Array of GoogleMapsBusiness objects
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../../lib/logger.js';
import type { GoogleMapsBusiness } from '@acquisition-engine/shared';

const DELAY_MS = 1500;

/** Adds a randomized delay between 1x and 2x of the base delay to avoid bot detection */
const delay = (base = DELAY_MS) =>
  new Promise((r) => setTimeout(r, base + Math.random() * base));

/**
 * Scrapes Google Maps for businesses matching niche + city.
 * @param niche - e.g. "gym", "restaurant", "dental clinic"
 * @param city - e.g. "Ludhiana", "Austin TX"
 * @param maxResults - Maximum businesses to return (default 20)
 */
export async function scrapeGoogleMaps(
  niche: string,
  city: string,
  maxResults = 20
): Promise<GoogleMapsBusiness[]> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const businesses: GoogleMapsBusiness[] = [];

  try {
    const searchQuery = encodeURIComponent(`${niche} in ${city}`);
    const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;

    logger.info(`Navigating to Google Maps: ${mapsUrl}`);
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay();

    // Accept cookies if prompted
    try {
      const cookieBtn = page.locator('button[aria-label*="Accept all"]').first();
      if (await cookieBtn.isVisible({ timeout: 3000 })) {
        await cookieBtn.click();
        await delay(500);
      }
    } catch { /* no cookie prompt */ }

    // Scroll to load more results
    const resultsPanel = page.locator('[role="feed"]').first();
    for (let i = 0; i < 5; i++) {
      try {
        await resultsPanel.evaluate((el) => ((el as any).scrollTop += 600));
        await delay(800);
      } catch { break; }
    }

    // Extract listing data from the DOM
    const html = await page.content();
    const $ = cheerio.load(html);

    // Google Maps result items — class patterns change; use multiple selectors
    const listingSelectors = [
      'a[href*="/maps/place/"]',
      '[data-result-index]',
      '.Nv2PK',
    ];

    const seen = new Set<string>();

    for (const selector of listingSelectors) {
      $(selector).each((_, el) => {
        if (businesses.length >= maxResults) return;

        const $el = $(el);
        const name = $el.find('.qBF1Pd, .fontHeadlineSmall, h3').first().text().trim();
        if (!name || seen.has(name)) return;
        seen.add(name);

        const href = $el.attr('href') ?? $el.find('a').attr('href') ?? '';
        const googleMapsUrl = href.startsWith('http')
          ? href
          : `https://www.google.com${href}`;

        const ratingText = $el.find('.MW4etd').text().trim();
        const reviewCountText = $el.find('.UY7F9').text().replace(/[()]/g, '').trim();
        const address = $el.find('.W4Efsd:last-child .W4Efsd span').last().text().trim();

        businesses.push({
          name,
          address: address || `${city}`,
          phone: '', // Requires visiting detail page
          google_maps_url: googleMapsUrl,
          google_rating: ratingText ? parseFloat(ratingText) : undefined,
          google_review_count: reviewCountText ? parseInt(reviewCountText, 10) : undefined,
          category: niche,
        });
      });

      if (businesses.length >= 3) break; // Found results
    }

    // If cheerio parsing failed, try Playwright locators
    if (businesses.length < 3) {
      logger.warn('Cheerio parsing got few results, trying Playwright locators...');
      const items = await page.locator('a[href*="/maps/place/"]').all();

      for (const item of items.slice(0, maxResults)) {
        try {
          const name = await item.locator('.qBF1Pd, .fontHeadlineSmall').first().textContent({ timeout: 1000 }) ?? '';
          const href = await item.getAttribute('href') ?? '';
          if (!name.trim() || seen.has(name.trim())) continue;
          seen.add(name.trim());

          businesses.push({
            name: name.trim(),
            address: city,
            phone: '',
            google_maps_url: href.startsWith('http') ? href : `https://www.google.com${href}`,
            category: niche,
          });
        } catch { /* skip */ }
      }
    }

    logger.info(`Google Maps scraper found ${businesses.length} businesses for "${niche}" in "${city}"`);

    // Enrich each listing with phone and website by visiting detail pages
    for (const business of businesses.slice(0, maxResults)) {
      try {
        await enrichBusinessFromDetailPage(page, business);
        await delay(1200);
      } catch (err) {
        logger.warn(`Failed to enrich ${business.name}`, { error: (err as Error).message });
      }
    }
  } catch (err) {
    logger.error('Google Maps scraper error', { error: (err as Error).message });
  } finally {
    await browser.close();
  }

  return businesses;
}

/**
 * Visits a Google Maps detail page to extract phone and website.
 * Mutates the business object in place.
 * @param page - An already-open Playwright page
 * @param business - The business to enrich
 */
async function enrichBusinessFromDetailPage(
  page: import('playwright').Page,
  business: GoogleMapsBusiness
): Promise<void> {
  if (!business.google_maps_url.includes('/maps/place/')) return;

  await page.goto(business.google_maps_url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await delay(800);

  const html = await page.content();
  const $ = cheerio.load(html);

  // Phone: aria-label contains "Phone:" or data-tooltip="Copy phone number"
  const phoneEl = $('[data-tooltip="Copy phone number"], [aria-label^="Phone:"]').first();
  if (phoneEl.length) {
    const phoneRaw = phoneEl.attr('aria-label') ?? phoneEl.attr('data-tooltip') ?? '';
    business.phone = phoneRaw.replace(/Phone:\s*/i, '').trim();
  }

  // Website: button/link with data-tooltip="Open website"
  const websiteEl = $('[data-tooltip="Open website"], a[aria-label*="website" i]').first();
  if (websiteEl.length) {
    business.website_url = websiteEl.attr('href') ?? undefined;
  }

  // Address: more accurate from detail page
  const addrEl = $('[data-tooltip="Copy address"], [aria-label^="Address:"]').first();
  if (addrEl.length) {
    business.address = (addrEl.attr('aria-label') ?? '').replace(/Address:\s*/i, '').trim();
  }

  // Photos
  const photoUrls: string[] = [];
  $('img[src*="lh5.googleusercontent.com"], img[src*="lh3.googleusercontent.com"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !photoUrls.includes(src)) photoUrls.push(src);
  });
  if (photoUrls.length) business.photos = photoUrls.slice(0, 5);
}
