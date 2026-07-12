/**
 * @file Google Maps scraper using Playwright headless browser.
 * Searches for businesses on Google Maps and extracts structured data.
 * Falls back to organic Google search results if Maps is inaccessible.
 *
 * @param niche - Business category (e.g. "dentist", "restaurant")
 * @param city - City to search in (e.g. "Austin TX")
 * @returns Array of GoogleMapsBusiness objects
 */

import logger from '../../lib/logger.js';
import type { GoogleMapsBusiness } from '@acquisition-engine/shared';

/**
 * Scrapes Google Maps for businesses matching niche + city using SerpAPI.
 * @param niche - e.g. "gym", "restaurant", "dental clinic"
 * @param city - e.g. "Ludhiana", "Austin TX"
 * @param maxResults - Maximum businesses to return (default 20)
 */
export async function* scrapeGoogleMaps(
  niche: string,
  city: string,
  maxResults: number | 'unlimited' = 20
): AsyncGenerator<GoogleMapsBusiness> {
  const serpapiKey = process.env.SERPAPI_KEY;
  if (!serpapiKey) {
    logger.error('SERPAPI_KEY is not defined in .env');
    throw new Error('SERPAPI_KEY is missing');
  }

  const query = encodeURIComponent(`${niche} in ${city}`);
  
  try {
    logger.info(`Fetching businesses from SerpAPI for query: ${niche} in ${city}`);
    
    let nextUrl = `https://serpapi.com/search.json?engine=google_local&q=${query}&location=${encodeURIComponent(city)}&api_key=${serpapiKey}`;
    let pageCount = 0;
    let yieldedCount = 0;
    
    while (nextUrl) {
      // Safety limit to avoid infinite loops or insane API costs
      if (pageCount >= 10) break;
      
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      const localResults = data.local_results || [];
      
      for (const result of localResults) {
        if (maxResults !== 'unlimited' && yieldedCount >= maxResults) return;
        
        if (!result.title) continue;

        yield {
          name: result.title,
          address: result.address || city,
          phone: result.phone || '',
          website_url: result.website || undefined,
          google_maps_url: result.links?.directions || result.links?.place || '',
          google_rating: result.rating ? parseFloat(result.rating) : undefined,
          google_review_count: result.reviews ? parseInt(result.reviews, 10) : undefined,
          category: result.type || niche,
          hero_image_url: result.thumbnail || undefined,
        };
        yieldedCount++;
      }
      
      nextUrl = data.serpapi_pagination?.next ? `${data.serpapi_pagination.next}&api_key=${serpapiKey}` : '';
      pageCount++;
    }

    logger.info(`SerpAPI yielded ${yieldedCount} raw businesses for "${niche}" in "${city}"`);
  } catch (err) {
    logger.error('SerpAPI search failed', { error: (err as Error).message });
  }
}

