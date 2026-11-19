import type { ContactEmail, ExecuteToolResponse, Lead } from '../types';
import { readRun, waitForRun, fetchAllItems } from './runs';
import { departmentOf } from './contacts';

type Item = Record<string, unknown>;
type ToolCall = (tool: string, args: Record<string, unknown>) => Promise<ExecuteToolResponse>;

const CONTACT_ACTOR = 'vdrmota/contact-info-scraper';
const PAGES_PER_SITE = 20;
const LINK_DEPTH = 2;
const PEOPLE_PER_DOMAIN = 25;

function hostOf(url: string): string {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

interface SiteContacts {
  emails: ContactEmail[];
  phones: string[];
  linkedin?: string;
  twitter?: string;
  facebook?: string;
}

// Every email and phone the crawler found for one site, plus marketing and HR people from the leads list
function collectSite(items: Item[]): SiteContacts {
  const emails = new Map<string, ContactEmail>();
  const phones = new Set<string>();
  let linkedin: string | undefined;
  let twitter: string | undefined;
  let facebook: string | undefined;

  for (const item of items) {
    for (const raw of strings(item.emails)) {
      const email = raw.toLowerCase();
      if (!emails.has(email)) {
        emails.set(email, { email, department: departmentOf(email.split('@')[0]) });
      }
    }
    for (const phone of strings(item.phones)) phones.add(phone);
    linkedin ??= str(strings(item.linkedIns)[0]);
    twitter ??= str(strings(item.twitters)[0]);
    facebook ??= str(strings(item.facebooks)[0]);

    const people = Array.isArray(item.leadsEnrichment) ? item.leadsEnrichment as Item[] : [];
    for (const person of people) {
      const email = str(person.email)?.toLowerCase();
      if (!email) continue;
      const titleText = [str(person.jobTitle), ...strings(person.departments)].filter(Boolean).join(' ');
      const department = departmentOf(titleText);
      if (!department) continue;
      emails.set(email, {
        email,
        department,
        name: str(person.fullName),
        title: str(person.jobTitle),
      });
      const mobile = str(person.mobileNumber);
      if (mobile) phones.add(mobile);
    }
  }

  return { emails: [...emails.values()], phones: [...phones], linkedin, twitter, facebook };
}

// Marketing first, then HR, then general addresses
const RANK: Record<string, number> = { marketing: 0, hr: 1 };

function applyContacts(lead: Lead, site: SiteContacts): Lead {
  const emails = [...site.emails].sort(
    (a, b) => (RANK[a.department ?? ''] ?? 2) - (RANK[b.department ?? ''] ?? 2),
  );
  return {
    ...lead,
    emails,
    email: emails[0]?.email ?? lead.email,
    phones: site.phones,
    phone: site.phones[0] ?? lead.phone,
    linkedin: site.linkedin ?? lead.linkedin,
    twitter: site.twitter ?? lead.twitter,
    facebook: site.facebook ?? lead.facebook,
    enrichment_status: 'completed' as const,
    enrichment_date: new Date().toISOString(),
  };
}

// Returns the enriched leads only; the caller merges them back into the full list
export async function enrichLeads(targets: Lead[], call: ToolCall): Promise<Lead[]> {
  const withSite = targets.filter(l => l.website && hostOf(l.website));
  if (withSite.length === 0) return [];

  const input = {
    startUrls: withSite.map(l => ({ url: l.website })),
    maxRequestsPerStartUrl: PAGES_PER_SITE,
    maxRequests: withSite.length * PAGES_PER_SITE,
    maxDepth: LINK_DEPTH,
    sameDomain: true,
    mergeContacts: true,
    maximumLeadsEnrichmentRecords: PEOPLE_PER_DOMAIN,
  };
  const response = await call('call-actor', { actor: CONTACT_ACTOR, input, waitSecs: 45 });
  const started = readRun(response.result);

  let items: Item[];
  if (started) {
    const run = await waitForRun(call, started, () => undefined);
    if (run.status !== 'SUCCEEDED') {
      throw new Error(`Contact scrape ${run.status.toLowerCase()}${run.statusMessage ? `: ${run.statusMessage}` : ''}`);
    }
    if (!run.datasetId) throw new Error('Contact scrape finished without a dataset');
    items = await fetchAllItems(call, run.datasetId);
  } else {
    items = ((response.result as Item | undefined)?.items as Item[] | undefined) ?? [];
  }

  const byHost = new Map<string, Item[]>();
  for (const item of items) {
    const source = str(item.originalStartUrl) ?? str(item.domain) ?? '';
    const host = hostOf(source);
    if (host) byHost.set(host, [...(byHost.get(host) ?? []), item]);
  }

  return withSite.map(lead => applyContacts(lead, collectSite(byHost.get(hostOf(lead.website ?? '')) ?? [])));
}
