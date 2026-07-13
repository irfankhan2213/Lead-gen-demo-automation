import logger from '../../lib/logger.js';
import { callLLM } from '../ai/client.js';
import { scrapeGoogleMaps } from './googleMaps.js';
import type { GoogleMapsBusiness } from '@acquisition-engine/shared';

export interface DiscoveryClassification {
  search_type: 'local' | 'organic';
  optimized_query: string;
}

const blockedDomains = [
  'linkedin.com', 'clutch.co', 'g2.com', 'capterra.com', 
  'crunchbase.com', 'yelp.com', 'tripadvisor.com', 
  'facebook.com', 'instagram.com', 'twitter.com',
  'glassdoor.com', 'indeed.com', 'trustpilot.com', 'wikipedia.org',
  'builtin.com', 'zoominfo.com', 'upcity.com', 'sortlist.com', 'softwareadvice.com',
  'getapp.com', 'craft.co', 'producthunt.com', 'ycombinator.com', 'angel.co', 'wellfound.com',
  'techcrunch.com', 'sifted.eu'
];

export async function classifyQuery(niche: string, city: string): Promise<DiscoveryClassification> {
  const prompt = `You are a search intent classifier for a lead generation tool. 
A user wants to find businesses matching this niche: "${niche}" in this location: "${city}".

Determine if this search is best suited for:
1. "local" (Google Maps) - for physical, traditional local businesses (e.g. plumbers, dentists, restaurants, local agencies).
2. "organic" (Google Web Search) - for digital, remote, B2B, SaaS, or highly specific startups that rarely have public storefronts on Google Maps (e.g. "Growing AI and B2B SaaS startups").

Also provide an "optimized_query". 
If local, just combine them naturally (e.g. "${niche} in ${city}").
If organic, optimize it for a web search to find company homepages (e.g. "AI SaaS startups in ${city}").
CRITICAL: Do NOT include newlines or unescaped quotes inside the JSON string values.

Return ONLY valid JSON in this format, with no markdown formatting:
{
  "search_type": "local" | "organic",
  "optimized_query": "string"
}`;

  try {
    const response = await callLLM(prompt, 500, true);
    const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      const result = JSON.parse(jsonStr);
      if (result.search_type === 'organic' || result.search_type === 'local') {
        return result as DiscoveryClassification;
      }
    } catch (parseErr) {
      logger.error('JSON Parse Error in classifyQuery', { raw_response: response, error: (parseErr as Error).message });
    }
  } catch (err) {
    logger.error('Failed to classify query, defaulting to local', { error: (err as Error).message });
  }
  return { search_type: 'local', optimized_query: `${niche} in ${city}` };
}

async function findOfficialWebsite(companyName: string): Promise<string | undefined> {
  const serpapiKey = process.env.SERPAPI_KEY;
  if (!serpapiKey) return undefined;
  
  const encodedQuery = encodeURIComponent(`"${companyName}" official website`);
  const url = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&api_key=${serpapiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    const organicResults = data.organic_results || [];
    
    for (const result of organicResults) {
      if (!result.link) continue;
      try {
        const hostname = new URL(result.link).hostname.toLowerCase();
        if (!blockedDomains.some(d => hostname.includes(d))) {
          return result.link;
        }
      } catch (e) { /* ignore */ }
    }
  } catch (err) {
    logger.warn(`Failed to find official website for ${companyName}`);
  }
  return undefined;
}

export async function* scrapeGoogleOrganic(
  query: string,
  city: string,
  maxResults: number | 'unlimited' = 20
): AsyncGenerator<GoogleMapsBusiness> {
  const serpapiKey = process.env.SERPAPI_KEY;
  if (!serpapiKey) {
    logger.error('SERPAPI_KEY is not defined in .env');
    throw new Error('SERPAPI_KEY is missing');
  }

  // We will run 3 X-Ray searches in parallel to gather raw results, then yield them.
  const platforms = [
    { name: 'General', siteQuery: '' },
    { name: 'LinkedIn', siteQuery: 'site:linkedin.com/company' },
    { name: 'Crunchbase', siteQuery: 'site:crunchbase.com/organization' }
  ];

  logger.info(`Fetching businesses via Multi-Platform X-Ray Search for query: ${query}`);

  const allRawResults: any[] = [];

  await Promise.all(platforms.map(async (platform) => {
    const fullQuery = platform.siteQuery ? `${platform.siteQuery} "${query}"` : query;
    const encodedQuery = encodeURIComponent(fullQuery);
    
    // tbs=qdr:y (Past year) to find newer companies for platforms
    const timeFilter = platform.siteQuery ? '&tbs=qdr:y' : '';
    const url = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}${timeFilter}&api_key=${serpapiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json() as any;
      if (data.organic_results) {
        // Tag with platform
        data.organic_results.forEach((r: any) => r._platform = platform.name);
        allRawResults.push(...data.organic_results);
      }
    } catch (err) {
      logger.warn(`Failed to fetch from platform ${platform.name}`);
    }
  }));

  let yieldedCount = 0;
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();

  for (const result of allRawResults) {
    if (maxResults !== 'unlimited' && yieldedCount >= maxResults) break;
    if (!result.title || !result.link) continue;

    try {
      const urlObj = new URL(result.link);
      const hostname = urlObj.hostname.toLowerCase();
      
      let companyName = result.title.split('-')[0].split('|')[0].trim();
      let websiteUrl = result.link;

      // If it's an aggregator/platform result, extract name and find real website
      if (blockedDomains.some(d => hostname.includes(d))) {
        // LinkedIn title is usually "CompanyName | LinkedIn"
        companyName = result.title.replace(/\|.*/, '').replace(/-.*/, '').trim();
        const official = await findOfficialWebsite(companyName);
        if (!official) continue; // Skip if we can't find real website
        websiteUrl = official;
      }

      // Deduplicate by name and domain
      const baseDomain = new URL(websiteUrl).hostname.replace(/^www\./, '');
      if (seenUrls.has(baseDomain) || seenNames.has(companyName.toLowerCase())) continue;
      
      seenUrls.add(baseDomain);
      seenNames.add(companyName.toLowerCase());
      
      yield {
        name: companyName,
        address: city,
        phone: '', 
        website_url: websiteUrl,
        google_maps_url: '', 
        category: `Organic Result (${result._platform})`,
      };
      yieldedCount++;
    } catch (e) {
      // invalid URL
    }
  }

  logger.info(`Multi-Platform Organic Search yielded ${yieldedCount} businesses`);
}

export async function* discoverBusinesses(
  niche: string,
  city: string,
  maxResults: number | 'unlimited' = 20
): AsyncGenerator<GoogleMapsBusiness> {
  const classification = await classifyQuery(niche, city);
  logger.info(`Query Classified: [${classification.search_type.toUpperCase()}] -> ${classification.optimized_query}`);
  
  if (classification.search_type === 'organic') {
    yield* scrapeGoogleOrganic(classification.optimized_query, city, maxResults);
  } else {
    yield* scrapeGoogleMaps(classification.optimized_query, "", maxResults);
  }
}
