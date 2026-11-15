import type { Lead } from '../types';

export const SEARCH_ACTOR = 'apify/google-search-scraper';

type Item = Record<string, unknown>;

// Sites that are never institutions worth contacting
const SKIP_HOSTS = [
  'google.',
  'apify.com',
  'wikipedia.org',
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'youtube.com',
  'bsky.app',
  'github.io',
  'countrycode.org',
  'graphemica.com',
  'shopify.dev',
  'microsoft.com',
  'github.com',
  'stackoverflow.com',
  'reddit.com',
  'indeed.com',
  'merriam-webster.com',
  'thefreedictionary.com',
  'wiktionary.org',
  'akademik.ru',
  'foldoc.org',
  'hugo.io',
  'yoctoproject.org',
  'swimlane.com',
  'vulncheck.com',
  'atradius.',
  'eujobs.',
  'wentin.net',
  'gaijin.at',
  'maryland.gov',
  't-systems.com',
];

function hostOf(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

// Known place names from the query; a query that names one of these is tagged with it
const PLACES: [RegExp, string][] = [
  [/\b(berlin)\b/i, 'Berlin'],
  [/\b(munich|münchen)\b/i, 'Munich'],
  [/\b(hamburg)\b/i, 'Hamburg'],
  [/\b(cologne|köln)\b/i, 'Cologne'],
  [/\b(frankfurt)\b/i, 'Frankfurt'],
  [/\b(heidelberg)\b/i, 'Heidelberg'],
  [/\b(münster|munster)\b/i, 'Münster'],
  [/\b(germany|deutschland)\b/i, 'Germany'],
];

// Country from the domain suffix; generic suffixes (.com, .org) say nothing about place
const COUNTRY_BY_TLD: Record<string, string> = {
  de: 'Germany', uk: 'United Kingdom', fr: 'France', es: 'Spain', it: 'Italy', nl: 'Netherlands',
  ch: 'Switzerland', at: 'Austria', be: 'Belgium', ie: 'Ireland', se: 'Sweden', no: 'Norway',
  dk: 'Denmark', fi: 'Finland', pl: 'Poland', pt: 'Portugal', gr: 'Greece', cz: 'Czechia',
  ca: 'Canada', us: 'United States', mx: 'Mexico', br: 'Brazil', ar: 'Argentina', au: 'Australia',
  nz: 'New Zealand', jp: 'Japan', cn: 'China', kr: 'South Korea', in: 'India', sg: 'Singapore',
  il: 'Israel', tr: 'Turkey', ru: 'Russia', za: 'South Africa', ng: 'Nigeria', eg: 'Egypt', ke: 'Kenya',
};

function placeIn(host: string, ...sources: (string | undefined)[]): string {
  const haystack = [host, ...sources].filter(Boolean).join(' ');
  const city = PLACES.find(([re]) => re.test(haystack))?.[1];
  if (city) return city;
  const tld = host.split('.').pop() ?? '';
  return COUNTRY_BY_TLD[tld] ?? 'Unknown';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// Accepts a Google Search dataset (one page per query) or a flat list of organic results
export function normalizeSearchResults(raw: unknown, sourceId = SEARCH_ACTOR): Lead[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const page of raw as Item[]) {
    const organic = Array.isArray(page.organicResults) ? (page.organicResults as Item[]) : [page];

    for (const item of organic) {
      const url = text(item.url);
      const host = url ? hostOf(url) : '';
      if (!url || !host || SKIP_HOSTS.some((skip) => host.includes(skip)) || seen.has(host)) continue;
      seen.add(host);

      const name = text(item.websiteTitle) ?? text(item.title) ?? host;
      const description = text(item.description);
      const query = text((page.searchQuery as Item | undefined)?.term) ?? text(page.query) ?? '';

      leads.push({
        id: `${sourceId}-${leads.length}-${host}`,
        name,
        type: 'Institution',
        location: placeIn(host, name, description, query),
        website: url,
        description,
        source_actor: sourceId,
        raw_data: item,
      });
    }
  }

  return leads;
}
