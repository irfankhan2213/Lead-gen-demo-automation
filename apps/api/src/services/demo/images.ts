/**
 * @file Niche-specific image bank and URL cleanup utilities.
 * Ensures generated sites use beautiful, high-resolution, hotlink-safe Unsplash images
 * instead of tiny icons, tracking pixels, or broken relative paths.
 */

import type { Lead } from '@acquisition-engine/shared';

export const NICHE_IMAGE_BANK: Record<string, string[]> = {
  dentist: [
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80',
  ],
  gym: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
  ],
  salon: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1605497746444-ac9da58d7d9b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?auto=format&fit=crop&w=800&q=80',
  ],
  clinic: [
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=800&q=80',
  ],
  lawyer: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1505664194779-8bebcb95c557?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=800&q=80',
  ],
  plumbing: [
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542013936693-8848e5740a95?auto=format&fit=crop&w=800&q=80',
  ],
  hvac: [
    'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=800&q=80',
  ],
  realestate: [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
  ],
  florist: [
    'https://images.unsplash.com/photo-1487530811015-780ab7873ab7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1490750967868-88df5691cc4d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
  ],
  auto: [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=800&q=80',
  ],
};

/** Generic / fallback images used when no niche match is found */
const GENERIC_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
];

/**
 * Returns a set of high-resolution Unsplash image URLs tailored to a business's niche.
 */
export function getNicheImages(niche: string): string[] {
  const norm = (niche || '').toLowerCase();
  if (norm.includes('dent') || norm.includes('teeth') || norm.includes('ortho')) return NICHE_IMAGE_BANK.dentist;
  if (norm.includes('gym') || norm.includes('fit') || norm.includes('crossfit') || norm.includes('workout') || norm.includes('athletic')) return NICHE_IMAGE_BANK.gym;
  if (norm.includes('rest') || norm.includes('food') || norm.includes('cafe') || norm.includes('bake') || norm.includes('dine') || norm.includes('pizza') || norm.includes('burger')) return NICHE_IMAGE_BANK.restaurant;
  if (norm.includes('salon') || norm.includes('hair') || norm.includes('spa') || norm.includes('nail') || norm.includes('beauty') || norm.includes('massage') || norm.includes('groom')) return NICHE_IMAGE_BANK.salon;
  if (norm.includes('clinic') || norm.includes('doctor') || norm.includes('health') || norm.includes('chiro') || norm.includes('physio') || norm.includes('med') || norm.includes('hosp')) return NICHE_IMAGE_BANK.clinic;
  if (norm.includes('law') || norm.includes('legal') || norm.includes('attorney') || norm.includes('court') || norm.includes('counsel')) return NICHE_IMAGE_BANK.lawyer;
  if (norm.includes('plumb')) return NICHE_IMAGE_BANK.plumbing;
  if (norm.includes('hvac') || norm.includes('air cond') || norm.includes('heat') || norm.includes('furnace') || norm.includes('cool')) return NICHE_IMAGE_BANK.hvac;
  if (norm.includes('real') || norm.includes('realt') || norm.includes('house') || norm.includes('home') || norm.includes('broker') || norm.includes('apart')) return NICHE_IMAGE_BANK.realestate;
  if (norm.includes('flor') || norm.includes('flower') || norm.includes('garden') || norm.includes('plant') || norm.includes('bouquet')) return NICHE_IMAGE_BANK.florist;
  if (norm.includes('auto') || norm.includes('car') || norm.includes('vehicle') || norm.includes('mechanic') || norm.includes('repair') || norm.includes('tyre') || norm.includes('tire')) return NICHE_IMAGE_BANK.auto;

  return GENERIC_IMAGES;
}

/**
 * Filter out relative URLs, tracking pixels, tiny icons, and social profile URLs.
 *
 * IMPORTANT: This filter is intentionally LOOSE. We only block true junk — tracking pixels,
 * loading spinners, 1x1 images, social profile pages — NOT patterns like 'logo' or 'map'
 * which frequently appear in legitimate CDN photo URLs (Cloudinary, Imgix, etc.).
 */
export function cleanScrapedImages(images: string[]): string[] {
  if (!Array.isArray(images)) return [];

  // Only block genuinely useless/tiny content
  const hardBlockKeywords = [
    'pixel', 'tracker', 'beacon', '1x1', 'blank.gif', 'spacer.gif', 'loading-spin',
    'wp-content/plugins', 'wp-admin',
  ];

  // Known social media profile domains to skip
  const socialDomains = [
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'pinterest.com', 'tiktok.com',
  ];

  // Minimum width for images that declare a width param
  const tooSmallPattern = /[?&]w=(\d+)/;

  // CDN patterns that indicate a real photo without a file extension
  const cdnPatterns = [
    'images.unsplash.com', 'res.cloudinary.com', 'imgix.net', 'cdn.shopify',
    'images.squarespace', 'lh3.googleusercontent', 'staticflickr', 'scontent.',
    'amazonaws.com', 'storage.googleapis', 'blob.core.windows',
    'media.', 'photos.', 'img.', 'cdn.', 'assets.', 'static.', 'content.',
  ];

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

  return images.filter(url => {
    if (!url || typeof url !== 'string') return false;
    try {
      const lower = url.toLowerCase();

      // Must be absolute
      if (!lower.startsWith('http')) return false;

      // Block hard junk
      if (hardBlockKeywords.some(kw => lower.includes(kw))) return false;

      // Block social profile pages
      if (socialDomains.some(d => lower.includes(d))) return false;

      // Skip very small declared images (but only when width is explicitly declared)
      const widthMatch = lower.match(tooSmallPattern);
      if (widthMatch && parseInt(widthMatch[1], 10) < 200) return false;

      // Skip SVGs (usually icons/logos)
      if (lower.endsWith('.svg') || lower.includes('.svg?')) return false;

      // Allow known image extensions
      if (validExtensions.some(ext => lower.includes(ext))) return true;

      // Allow known CDN patterns (no extension needed)
      if (cdnPatterns.some(cdn => lower.includes(cdn))) return true;

      // Default: allow any valid HTTPS URL with a real path
      const parsed = new URL(url);
      return parsed.pathname.length > 1;
    } catch {
      return false;
    }
  });
}

/**
 * Returns exactly 4 guaranteed, valid image URLs for a lead — never undefined or empty.
 * Priority: hero_image_url → cleaned scraped images → niche stock images.
 *
 * Returns a tuple: [heroImage, galleryImage1, galleryImage2, galleryImage3]
 */
export function getGuaranteedImages(lead: Partial<Lead>): [string, string, string, string] {
  const stock = getNicheImages(lead.niche || '');
  const cleaned = cleanScrapedImages(lead.scraped_images || []);

  // Build a deduplicated pool in priority order
  const pool: string[] = [];

  const addIfNew = (url: string | undefined | null) => {
    if (url && typeof url === 'string' && url.startsWith('http') && !pool.includes(url)) {
      pool.push(url);
    }
  };

  // Highest priority: explicit hero image
  addIfNew(lead.hero_image_url);

  // Next: cleaned scraped images
  for (const img of cleaned) addIfNew(img);

  // Fallback: niche stock
  for (const img of stock) addIfNew(img);

  // Always pad to at least 4 slots
  while (pool.length < 4) {
    pool.push(GENERIC_IMAGES[pool.length % GENERIC_IMAGES.length]);
  }

  return [pool[0], pool[1], pool[2], pool[3]];
}
