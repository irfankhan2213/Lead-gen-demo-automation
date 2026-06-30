/**
 * @file Website scraper — extracts brand data from a business's own website.
 * Looks for: colors, fonts, tagline, about text, services, pricing, social links.
 *
 * @param url - The business website URL to scrape
 * @returns WebsiteScrapedData object (all fields optional)
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../../lib/logger.js';
import type { WebsiteScrapedData, SocialLinks } from '@acquisition-engine/shared';

/**
 * Scrapes a business website for brand intelligence.
 * @param url - Full URL to scrape (e.g. "https://example.com")
 * @returns Parsed brand data or empty object if scraping fails
 */
export async function scrapeBusinessWebsite(url?: string): Promise<WebsiteScrapedData> {
  if (!url) return {};

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http')) normalizedUrl = `https://${url}`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await context.newPage();
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    // ─── Extract Brand Colors ─────────────────────────────────────────────────
    const colors = new Set<string>();

    // From inline styles
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') ?? '';
      const hexMatches = style.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
      hexMatches.forEach((c) => colors.add(c.toLowerCase()));
    });

    // From CSS in <style> tags
    $('style').each((_, el) => {
      const css = $(el).html() ?? '';
      const hexMatches = css.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
      hexMatches.forEach((c) => colors.add(c.toLowerCase()));
    });

    // Extract theme-color meta tag
    const themeColor = $('meta[name="theme-color"]').attr('content');
    if (themeColor) colors.add(themeColor.toLowerCase());

    // Filter out near-white and near-black generic colors
    const filteredColors = [...colors].filter((c) => {
      const hex = c.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.1 && luminance < 0.9; // exclude very dark/light
    });

    // ─── Extract Fonts ────────────────────────────────────────────────────────
    const fonts: string[] = [];
    $('link[href*="fonts.googleapis.com"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const families = href.match(/family=([^&:]+)/);
      if (families?.[1]) {
        families[1].split('|').forEach((f) => fonts.push(decodeURIComponent(f.replace(/\+/g, ' '))));
      }
    });

    // ─── Extract Tagline ──────────────────────────────────────────────────────
    const metaDesc = $('meta[name="description"]').attr('content') ?? '';
    const ogDesc = $('meta[property="og:description"]').attr('content') ?? '';
    const h1Text = $('h1').first().text().trim();
    const heroText = $('[class*="hero"] p, [class*="banner"] p, [class*="headline"] p').first().text().trim();

    const tagline = heroText || h1Text || metaDesc || ogDesc || '';

    // ─── Extract About Text ───────────────────────────────────────────────────
    let aboutText = '';
    const aboutSelectors = [
      '[class*="about"] p',
      '[id*="about"] p',
      'section:has(h2:contains("About")) p',
      'section:has(h2:contains("Who We Are")) p',
      'section:has(h2:contains("Our Story")) p',
    ];
    for (const sel of aboutSelectors) {
      const text = $(sel).first().text().trim();
      if (text.length > 50) { aboutText = text; break; }
    }

    // ─── Extract Services ─────────────────────────────────────────────────────
    const services: string[] = [];
    const serviceSelectors = [
      '[class*="service"] h3, [class*="service"] h4',
      '[class*="treatment"] h3, [class*="treatment"] h4',
      '[class*="menu-item"] h3, [class*="menu"] h3',
      '[class*="package"] h3',
      'ul[class*="service"] li',
      'section:has(h2:contains("Service")) li',
      'section:has(h2:contains("Menu")) li',
    ];
    for (const sel of serviceSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 80 && !services.includes(text)) {
          services.push(text);
        }
      });
    }

    // ─── Extract Social Links ─────────────────────────────────────────────────
    const socialLinks: SocialLinks = {};
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (href.includes('instagram.com') && !socialLinks.instagram) socialLinks.instagram = href;
      if (href.includes('facebook.com') && !socialLinks.facebook) socialLinks.facebook = href;
      if (href.includes('twitter.com') && !socialLinks.twitter) socialLinks.twitter = href;
      if (href.includes('linkedin.com') && !socialLinks.linkedin) socialLinks.linkedin = href;
      if (href.includes('youtube.com') && !socialLinks.youtube) socialLinks.youtube = href;
    });

    // ─── Extract Pricing ──────────────────────────────────────────────────────
    const pricing: Record<string, string>[] = [];
    $('[class*="price"], [class*="pricing"]').each((_, el) => {
      const name = $(el).find('h3, h4, .title').first().text().trim();
      const price = $(el).find('[class*="price"], .amount').first().text().trim();
      if (name && price) pricing.push({ name, price });
    });

    const result: WebsiteScrapedData = {
      brand_colors: filteredColors.slice(0, 5),
      brand_fonts: fonts.slice(0, 3),
      tagline: tagline.slice(0, 200) || undefined,
      about_text: aboutText.slice(0, 1000) || undefined,
      services: services.slice(0, 10),
      menu_or_pricing: pricing.slice(0, 10),
      social_links: Object.keys(socialLinks).length ? socialLinks : undefined,
      meta_description: metaDesc || undefined,
    };

    logger.info(`Website scraped: ${normalizedUrl}`, {
      colors: result.brand_colors?.length,
      services: result.services?.length,
    });

    return result;
  } catch (err) {
    logger.warn(`Website scrape failed for ${normalizedUrl}`, { error: (err as Error).message });
    return {};
  } finally {
    await browser.close();
  }
}
