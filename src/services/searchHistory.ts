import { invoke } from '@tauri-apps/api/core';
import type { SearchOptions, Lead } from '../types';

const STORE_KEY = 'saved_searches';
const HISTORY_KEY = 'search_history';

export interface SavedSearch {
  id: string;
  name: string;
  options: SearchOptions;
  createdAt: string;
  lastRunAt?: string;
  seenDomains: string[];
  schedule?: {
    cron: string;
    timezone: string;
    enabled: boolean;
    apifyScheduleId?: string;
  };
}

export interface SearchHistoryEntry {
  searchId: string;
  runAt: string;
  leadCount: number;
  newLeadCount: number;
  newDomains: string[];
}

function hostOf(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  try {
    const stored = await invoke<string | null>('get_store_value', { key: STORE_KEY });
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to load saved searches:', err);
  }
  return [];
}

export async function saveSearch(search: SavedSearch): Promise<void> {
  const searches = await getSavedSearches();
  const existing = searches.findIndex(s => s.id === search.id);
  if (existing >= 0) {
    searches[existing] = search;
  } else {
    searches.push(search);
  }
  await invoke('set_store_value', { key: STORE_KEY, value: JSON.stringify(searches) });
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const searches = await getSavedSearches();
  const filtered = searches.filter(s => s.id !== id);
  await invoke('set_store_value', { key: STORE_KEY, value: JSON.stringify(filtered) });
}

export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  try {
    const stored = await invoke<string | null>('get_store_value', { key: HISTORY_KEY });
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to load search history:', err);
  }
  return [];
}

export async function addSearchHistory(entry: SearchHistoryEntry): Promise<void> {
  const history = await getSearchHistory();
  history.unshift(entry);
  // Keep last 100 entries
  if (history.length > 100) history.splice(100);
  await invoke('set_store_value', { key: HISTORY_KEY, value: JSON.stringify(history) });
}

export function findNewLeads(leads: Lead[], seenDomains: string[]): { newLeads: Lead[]; newDomains: string[] } {
  const seen = new Set(seenDomains);
  const newLeads: Lead[] = [];
  const newDomains: string[] = [];
  
  for (const lead of leads) {
    if (lead.website) {
      const domain = hostOf(lead.website);
      if (domain && !seen.has(domain)) {
        newLeads.push({ ...lead, isNew: true });
        newDomains.push(domain);
        seen.add(domain);
      } else {
        newLeads.push({ ...lead, isNew: false });
      }
    } else {
      newLeads.push({ ...lead, isNew: false });
    }
  }
  
  return { newLeads, newDomains };
}

export function generateSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}