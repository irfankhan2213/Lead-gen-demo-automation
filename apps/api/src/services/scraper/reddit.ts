/**
 * @file Reddit mention scraper.
 * Searches Reddit (via Pushshift/old Reddit JSON API — no key needed) for
 * brand mentions of a business in a given city. Returns structured mentions
 * with basic sentiment scoring.
 *
 * @param businessName - Business to search for
 * @param city - City context to narrow results
 * @returns Array of RedditMention objects
 */

import logger from '../../lib/logger.js';
import type { RedditMention } from '@acquisition-engine/shared';

const REDDIT_SEARCH_URL = 'https://www.reddit.com/search.json';
const USER_AGENT = 'AcquisitionEngine/1.0 (lead research tool)';

/** Basic positive/negative keyword lists for naive sentiment */
const POSITIVE_WORDS = new Set([
  'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic',
  'recommend', 'wonderful', 'perfect', 'delicious', 'outstanding', 'superb',
  'friendly', 'clean', 'helpful', 'professional', 'quality', 'good',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'avoid', 'rude',
  'dirty', 'expensive', 'overpriced', 'disappointing', 'disgusting',
  'unprofessional', 'slow', 'cold', 'stale', 'never again', 'waste',
]);

/**
 * Analyzes a text string and returns a sentiment label.
 * @param text - Text to analyze
 */
function analyzeSentiment(text: string): RedditMention['sentiment'] {
  const words = text.toLowerCase().split(/\W+/);
  let score = 0;
  words.forEach((w) => {
    if (POSITIVE_WORDS.has(w)) score++;
    if (NEGATIVE_WORDS.has(w)) score--;
  });
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

/**
 * Scrapes Reddit for mentions of a business.
 * Uses the public Reddit JSON API (no authentication required).
 *
 * @param businessName - Name of the business to search for
 * @param city - City context (added to query)
 * @param maxResults - Max mentions to return (default 5)
 */
export async function scrapeRedditMentions(
  businessName: string,
  city: string,
  maxResults = 5
): Promise<RedditMention[]> {
  const mentions: RedditMention[] = [];

  try {
    const query = encodeURIComponent(`"${businessName}" ${city}`);
    const url = `${REDDIT_SEARCH_URL}?q=${query}&sort=relevance&limit=10&type=link`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`Reddit API returned ${response.status} for "${businessName}"`);
      return [];
    }

    const data = await response.json() as {
      data?: {
        children?: Array<{
          data: {
            subreddit: string;
            title: string;
            selftext?: string;
            url: string;
            score: number;
          };
        }>;
      };
    };

    const posts = data?.data?.children ?? [];

    for (const post of posts.slice(0, maxResults)) {
      const { subreddit, title, selftext, url } = post.data;
      const text = `${title} ${selftext ?? ''}`.trim().slice(0, 500);
      if (!text) continue;

      mentions.push({
        subreddit: `r/${subreddit}`,
        text,
        sentiment: analyzeSentiment(text),
        url,
      });
    }

    logger.info(`Reddit: found ${mentions.length} mentions for "${businessName}"`);
  } catch (err) {
    logger.warn('Reddit scrape failed', { error: (err as Error).message });
  }

  return mentions;
}
