/**
 * @file Website scraper — extracts brand data from a business's own website.
 * Looks for: colors, fonts, tagline, about text, services, pricing, social links,
 * email addresses, and phone numbers.
 *
 * @param url - The business website URL to scrape
 * @returns WebsiteScrapedData object (all fields optional)
 */

import { chromium, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import * as dns from 'dns/promises';
import logger from '../../lib/logger.js';
import type { WebsiteScrapedData, SocialLinks } from '@acquisition-engine/shared';

/** Matches most common email patterns in text/HTML */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Matches common phone number formats: (555) 123-4567, +1-555-123-4567, 555.123.4567, etc. */
const PHONE_REGEX = /(\+?\d{1,3}[\s\-.]?)?(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})/g;

/** Junk emails to ignore (noreply, support, wordpress, etc.) */
const JUNK_EMAIL_PATTERNS = /noreply|no-reply|donotreply|@sentry|@example|@wordpress|@wix|placeholder/i;

/**
 * Extracts all unique real emails from HTML content/text, filtering out junk.
 */
function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  return matches.filter((e) => {
    const lower = e.toLowerCase();
    if (JUNK_EMAIL_PATTERNS.test(lower)) return false;
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Extracts the best phone number from text, preferring longer formatted numbers.
 */
function extractPhone(text: string): string | undefined {
  const matches = text.match(PHONE_REGEX) ?? [];
  const cleaned = matches
    .map((m) => m.trim())
    .filter((m) => m.replace(/\D/g, '').length >= 10)
    .sort((a, b) => b.length - a.length);
  return cleaned[0];
}

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF) against internal networks.
 */
async function isSafeUrl(targetUrl: string): Promise<boolean> {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname;
    // Skip if it's explicitly an IP that's local
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    
    const { address } = await dns.lookup(hostname);
    
    // IPv4 private/loopback/link-local
    if (address.startsWith('127.') || 
        address.startsWith('10.') || 
        address.startsWith('192.168.') || 
        address.startsWith('169.254.')) {
      return false;
    }
    
    // IPv4 172.16.0.0/12
    if (address.startsWith('172.')) {
      const secondOctet = parseInt(address.split('.')[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }
    
    // IPv6 loopback/unique-local/link-local
    const ipv6 = address.toLowerCase();
    if (ipv6 === '::1' || ipv6.startsWith('fd') || ipv6.startsWith('fe8')) {
      return false;
    }
    
    return true;
  } catch (err) {
    return false; // DNS resolution failed or invalid URL
  }
}

/**
 * Scrapes a business website for brand intelligence including contact info.
 * @param url - Full URL to scrape (e.g. "https://example.com")
 * @param sharedContext - Optional Playwright BrowserContext for pooling to reduce memory/startup overhead
 * @returns Parsed brand data or empty object if scraping fails
 */
export async function scrapeBusinessWebsite(url?: string, sharedContext?: BrowserContext): Promise<WebsiteScrapedData> {
  if (!url) return {};

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http')) normalizedUrl = `https://${url}`;

  // SSRF Protection check
  if (!(await isSafeUrl(normalizedUrl))) {
    logger.warn(`SSRF attempt blocked for URL: ${normalizedUrl}`);
    return {};
  }

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
      viewport: { width: 1280, height: 800 },
    });
  }

  const page = await context.newPage();
  try {
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    // ─── Extract Brand Colors ─────────────────────────────────────────────────
    const colors = new Set<string>();
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') ?? '';
      const hexMatches = style.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
      hexMatches.forEach((c) => colors.add(c.toLowerCase()));
    });
    $('style').each((_, el) => {
      const css = $(el).html() ?? '';
      const hexMatches = css.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
      hexMatches.forEach((c) => colors.add(c.toLowerCase()));
    });
    const themeColor = $('meta[name="theme-color"]').attr('content');
    if (themeColor) colors.add(themeColor.toLowerCase());
    const filteredColors = [...colors].filter((c) => {
      const hex = c.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.1 && luminance < 0.9;
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
        if (text && text.length < 80 && !services.includes(text)) services.push(text);
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

    // ─── Extract Email from main page ─────────────────────────────────────────
    const mailtoEmails: string[] = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (email && !JUNK_EMAIL_PATTERNS.test(email)) mailtoEmails.push(email);
    });
    const pageText = $.text();
    const textEmails = extractEmails(pageText);
    const allEmails = [...new Set([...mailtoEmails, ...textEmails])];

    // ─── Extract Phone from main page ─────────────────────────────────────────
    let phoneFromTel: string | undefined;
    $('a[href^="tel:"]').each((_, el) => {
      if (phoneFromTel) return;
      phoneFromTel = $(el).attr('href')?.replace(/^tel:/i, '').trim();
    });
    const phoneFromText = extractPhone(pageText);
    let foundPhone = phoneFromTel || phoneFromText;

    // ─── Visit common subpages for deeper extraction (Parallel) ───────────────
    let contactEmail: string | undefined;
    let contactPhone: string | undefined;

    // Only scrape subpages if we don't have an email
    if (allEmails.length === 0) {
      const subpages = ['/contact', '/contact-us', '/about', '/about-us', '/team'];
      const baseUrl = new URL(normalizedUrl);
      
      const subpagePromises = subpages.map(async (path) => {
        const subpageUrl = `${baseUrl.origin}${path}`;
        if (subpageUrl === normalizedUrl) return;

        // Use the shared context to open a new tab concurrently
        const subPageTab = await context.newPage();
        try {
          await subPageTab.goto(subpageUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
          const contactHtml = await subPageTab.content();
          const $c = cheerio.load(contactHtml);

          // mailto links on contact page
          $c('a[href^="mailto:"]').each((_, el) => {
            const href = $c(el).attr('href') ?? '';
            const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
            if (email && !JUNK_EMAIL_PATTERNS.test(email)) contactEmail = email;
          });

          if (!contactEmail) {
            const contactText = $c.text();
            const contactEmails = extractEmails(contactText);
            if (contactEmails.length) contactEmail = contactEmails[0];
          }

          // Phone from contact page
          if (!contactPhone) {
            $c('a[href^="tel:"]').each((_, el) => {
              if (contactPhone) return;
              contactPhone = $c(el).attr('href')?.replace(/^tel:/i, '').trim();
            });
            if (!contactPhone) contactPhone = extractPhone($c.text());
          }
        } finally {
          await subPageTab.close();
        }
      });

      await Promise.allSettled(subpagePromises);
    }

    const finalEmail = contactEmail ?? allEmails[0];
    const finalPhone = contactPhone ?? foundPhone;

    const result: WebsiteScrapedData = {
      brand_colors: filteredColors.slice(0, 5),
      brand_fonts: fonts.slice(0, 3),
      tagline: tagline.slice(0, 200) || undefined,
      about_text: aboutText.slice(0, 1000) || undefined,
      services: services.slice(0, 10),
      menu_or_pricing: pricing.slice(0, 10),
      social_links: Object.keys(socialLinks).length ? socialLinks : undefined,
      meta_description: metaDesc || undefined,
      email: finalEmail,
      phone: finalPhone,
    };

    logger.info(`Website scraped: ${normalizedUrl}`, {
      colors: result.brand_colors?.length,
      services: result.services?.length,
      email: finalEmail ? '✓' : '✗',
      phone: finalPhone ? '✓' : '✗',
    });

    return result;
  } catch (err) {
    logger.warn(`Website scrape failed for ${normalizedUrl}`, { error: (err as Error).message });
    return {};
  } finally {
    await page.close().catch(() => {});
    if (browser) {
      await browser.close();
    }
  }
}
