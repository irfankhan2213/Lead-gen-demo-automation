/**
 * @file Niche-specific image bank and URL cleanup utilities.
 * Ensures generated sites use beautiful, high-resolution, hotlink-safe Unsplash images
 * instead of tiny icons, tracking pixels, or broken relative paths.
 */

export const NICHE_IMAGE_BANK: Record<string, string[]> = {
  dentist: [
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80'
  ],
  gym: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80'
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80'
  ],
  salon: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1605497746444-ac9da58d7d9b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?auto=format&fit=crop&w=800&q=80'
  ],
  clinic: [
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=800&q=80'
  ],
  lawyer: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1505664194779-8bebcb95c557?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=800&q=80'
  ],
  plumbing: [
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542013936693-8848e5740a95?auto=format&fit=crop&w=800&q=80'
  ],
  hvac: [
    'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=800&q=80'
  ],
  realestate: [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
  ]
};

/**
 * Returns a set of high-resolution Unsplash image URLs tailored to a business's niche.
 */
export function getNicheImages(niche: string): string[] {
  const norm = (niche || '').toLowerCase();
  if (norm.includes('dent') || norm.includes('teeth')) return NICHE_IMAGE_BANK.dentist;
  if (norm.includes('gym') || norm.includes('fit') || norm.includes('crossfit') || norm.includes('workout') || norm.includes('athletic')) return NICHE_IMAGE_BANK.gym;
  if (norm.includes('rest') || norm.includes('food') || norm.includes('cafe') || norm.includes('bake') || norm.includes('dine') || norm.includes('pizza') || norm.includes('burger')) return NICHE_IMAGE_BANK.restaurant;
  if (norm.includes('salon') || norm.includes('hair') || norm.includes('spa') || norm.includes('nail') || norm.includes('beauty') || norm.includes('massage') || norm.includes('groom')) return NICHE_IMAGE_BANK.salon;
  if (norm.includes('clinic') || norm.includes('doctor') || norm.includes('health') || norm.includes('chiro') || norm.includes('physio') || norm.includes('med') || norm.includes('hosp')) return NICHE_IMAGE_BANK.clinic;
  if (norm.includes('law') || norm.includes('legal') || norm.includes('attorney') || norm.includes('court') || norm.includes('counsel')) return NICHE_IMAGE_BANK.lawyer;
  if (norm.includes('plumb')) return NICHE_IMAGE_BANK.plumbing;
  if (norm.includes('hvac') || norm.includes('air cond') || norm.includes('heat') || norm.includes('furnace') || norm.includes('cool')) return NICHE_IMAGE_BANK.hvac;
  if (norm.includes('real') || norm.includes('realt') || norm.includes('house') || norm.includes('home') || norm.includes('broker') || norm.includes('apart')) return NICHE_IMAGE_BANK.realestate;
  
  // Generic / Default
  return [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'
  ];
}

/**
 * Filter out relative URLs, small icons, avatars, social graphics, and tracking pixels.
 */
export function cleanScrapedImages(images: string[]): string[] {
  if (!Array.isArray(images)) return [];
  const filterKeywords = [
    'icon', 'logo', 'avatar', 'thumb', 'small', 'btn', 'arrow', 'star', 
    'rating', 'check', 'play', 'facebook', 'twitter', 'instagram', 
    'linkedin', 'youtube', 'pinterest', 'google', 'wp-content/plugins',
    'wp-content/themes', 'loading', 'gif', 'svg', 'pixel', 'tracker',
    'marker', 'map', 'close', 'menu', 'search'
  ];
  
  return images.filter(url => {
    try {
      const lower = url.toLowerCase();
      // Must start with http/https
      if (!lower.startsWith('http')) return false;
      // Must not match any bad keywords
      for (const kw of filterKeywords) {
        if (lower.includes(kw)) return false;
      }
      return true;
    } catch {
      return false;
    }
  });
}
