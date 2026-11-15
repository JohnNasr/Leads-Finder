import type { Actor } from '../types';

// Shown even before Apify is connected, so the list is never empty
export const SUGGESTED_ACTORS: Actor[] = [
  {
    id: 'apify/google-search-scraper',
    name: 'Google Search Scraper',
    description: 'Search Google and return organic results. Best starting point for finding institutions.',
    tool_name: 'apify/google-search-scraper',
  },
  {
    id: 'apify/website-content-crawler',
    name: 'Website Content Crawler',
    description: 'Crawl institution websites and extract page text to enrich each lead.',
    tool_name: 'apify/website-content-crawler',
  },
  {
    id: 'apify/contact-info-scraper',
    name: 'Contact Info Scraper',
    description: 'Pull public emails, phone numbers and social links from websites.',
    tool_name: 'apify/contact-info-scraper',
  },
];

export function matchesActor(actor: Actor, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return actor.name.toLowerCase().includes(needle) || actor.description.toLowerCase().includes(needle);
}
