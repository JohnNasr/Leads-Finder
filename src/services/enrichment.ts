import { mcpService } from './mcp';
import type { Lead } from '../types';

interface EnrichmentResult {
  emails: string[];
  phones: string[];
  social: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
}

async function callWebsiteCrawler(urls: string[]): Promise<EnrichmentResult[]> {
  const response = await mcpService.executeTool({
    server_id: 'apify',
    tool_name: 'apify/website-content-crawler',
    arguments: {
      startUrls: urls.map(url => ({ url })),
      maxCrawlDepth: 1,
      maxConcurrency: 5,
    },
  });
  return extractEnrichmentData(response.result);
}

async function callContactInfoScraper(urls: string[]): Promise<EnrichmentResult[]> {
  const response = await mcpService.executeTool({
    server_id: 'apify',
    tool_name: 'apify/contact-info-scraper',
    arguments: {
      startUrls: urls.map(url => ({ url })),
      maxConcurrency: 5,
    },
  });
  return extractEnrichmentData(response.result);
}

function extractEnrichmentData(result: unknown): EnrichmentResult[] {
  const items: Record<string, unknown>[] = [];
  const structured = (result as Record<string, unknown> | undefined)?.structuredContent;
  if (typeof structured === 'object' && structured !== null) items.push(structured as Record<string, unknown>);
  const content = (result as Record<string, unknown> | undefined)?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      const text = (block as Record<string, unknown>)?.text;
      if (typeof text === 'string') {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed === 'object' && parsed !== null) items.push(parsed as Record<string, unknown>);
        } catch {
          // not JSON
        }
      }
    }
  }
  if (typeof result === 'object' && result !== null) items.push(result as Record<string, unknown>);

  return items.map(item => {
    const emails = Array.isArray(item.emails) ? item.emails.filter(e => typeof e === 'string') as string[] : [];
    const phones = Array.isArray(item.phones) ? item.phones.filter(p => typeof p === 'string') as string[] : [];
    const social = (item.social as Record<string, unknown> | undefined) || {};
    return {
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      social: {
        linkedin: typeof social.linkedin === 'string' ? social.linkedin : undefined,
        twitter: typeof social.twitter === 'string' ? social.twitter : undefined,
        facebook: typeof social.facebook === 'string' ? social.facebook : undefined,
      },
    };
  });
}

export async function enrichLeads(leads: Lead[]): Promise<Lead[]> {
  const leadsWithWebsites = leads.filter(l => l.website);
  if (leadsWithWebsites.length === 0) return leads;

  const urls = leadsWithWebsites.map(l => l.website!);
  
  // First crawl websites to get content
  const crawlResults = await callWebsiteCrawler(urls);
  
  // Then extract contact info
  const contactResults = await callContactInfoScraper(urls);

  // Merge results back into leads
  const enrichedLeads = leads.map(lead => {
    if (!lead.website) return lead;
    const idx = urls.indexOf(lead.website);
    if (idx === -1) return lead;

    const crawl = crawlResults[idx];
    const contact = contactResults[idx];

    const allEmails = [...new Set([...(crawl.emails || []), ...(contact.emails || [])])];
    const allPhones = [...new Set([...(crawl.phones || []), ...(contact.phones || [])])];

    return {
      ...lead,
      email: allEmails[0] || lead.email,
      phone: allPhones[0] || lead.phone,
      linkedin: crawl.social.linkedin || contact.social.linkedin,
      twitter: crawl.social.twitter || contact.social.twitter,
      facebook: crawl.social.facebook || contact.social.facebook,
      enrichment_status: 'completed' as const,
      enrichment_date: new Date().toISOString(),
    };
  });

  return enrichedLeads;
}

export async function enrichSingleLead(lead: Lead): Promise<Lead> {
  if (!lead.website) return lead;
  
  const results = await enrichLeads([lead]);
  return results[0];
}