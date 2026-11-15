import { useState, type KeyboardEvent } from 'react';
import { useMCP } from '../hooks/useMCP';
import { errorMessage } from '../services/mcp';
import { normalizeSearchResults, SEARCH_ACTOR } from '../services/leads';
import { fetchAllItems, readRun, waitForRun } from '../services/runs';
import type { Actor, Lead } from '../types';

type Item = Record<string, unknown>;

const COUNTRIES: { code: string; label: string }[] = [
  { code: '', label: 'Worldwide' },
  { code: 'de', label: 'Germany' },
  { code: 'at', label: 'Austria' },
  { code: 'au', label: 'Australia' },
  { code: 'be', label: 'Belgium' },
  { code: 'br', label: 'Brazil' },
  { code: 'ca', label: 'Canada' },
  { code: 'ch', label: 'Switzerland' },
  { code: 'es', label: 'Spain' },
  { code: 'fr', label: 'France' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'in', label: 'India' },
  { code: 'it', label: 'Italy' },
  { code: 'jp', label: 'Japan' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'se', label: 'Sweden' },
  { code: 'sg', label: 'Singapore' },
  { code: 'us', label: 'United States' },
  { code: 'za', label: 'South Africa' },
];

const LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: 'All languages' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
];

const RESULT_CHOICES = [25, 50, 100, 200];
const PAGE_CHOICES = [1, 2, 3];
const DEFAULT_RESULTS = 50;

export interface SearchOptions {
  queries: string[];
  countryCode: string;
  languageCode: string;
  maxPagesPerQuery: number;
  resultsPerPage: number;
}

function buildSearchInput(opts: SearchOptions): Item {
  const input: Item = {
    // The actor reads one query per line
    queries: opts.queries.join('\n'),
    languageCode: opts.languageCode,
    maxPagesPerQuery: opts.maxPagesPerQuery,
    resultsPerPage: opts.resultsPerPage,
  };
  // Worldwide means no country filter at all
  if (opts.countryCode) input.countryCode = opts.countryCode;
  if (!opts.languageCode) delete input.languageCode;
  return input;
}

const LIST_KEYS = ['items', 'data', 'results', 'organic_results', 'organicResults'];

function itemsFromValue(value: unknown): Item[] | null {
  if (Array.isArray(value)) return value.filter((v): v is Item => typeof v === 'object' && v !== null);
  if (typeof value === 'object' && value !== null) {
    for (const key of LIST_KEYS) {
      const found = itemsFromValue((value as Item)[key]);
      if (found) return found;
    }
  }
  return null;
}

// MCP tool results arrive as { content: [{ type: 'text', text }], structuredContent? }
function extractItems(result: unknown): Item[] {
  const direct = itemsFromValue((result as Item | undefined)?.structuredContent) ?? itemsFromValue(result);
  if (direct) return direct;
  const content = (result as Item | undefined)?.content;
  if (!Array.isArray(content)) return [];
  for (const block of content) {
    const text = (block as Item)?.text;
    if (typeof text !== 'string') continue;
    try {
      const found = itemsFromValue(JSON.parse(text));
      if (found) return found;
    } catch {
      // not JSON; try the next block
    }
  }
  return [];
}

interface QueryTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled: boolean;
}

// Each Enter turns the typed text into its own removable bubble
function QueryTags({ tags, onChange, disabled }: QueryTagsProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const value = draft.trim();
    if (!value) return;
    if (!tags.some(t => t.toLowerCase() === value.toLowerCase())) onChange([...tags, value]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="input flex flex-wrap items-center gap-2 h-auto min-h-10 py-1.5 focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:border-blue-500">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-100 ring-1 ring-inset ring-blue-400/40"
        >
          {tag}
          <button
            type="button"
            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-blue-100 disabled:opacity-50"
            onClick={() => onChange(tags.filter(t => t !== tag))}
            disabled={disabled}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id="search-query"
        type="text"
        className="flex-1 min-w-[12rem] bg-transparent outline-none text-sm py-1 placeholder:text-slate-400"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? 'Type a search and press Enter, e.g. "universities in Berlin"' : 'Add another search…'}
        disabled={disabled}
        aria-describedby="query-hint"
      />
    </div>
  );
}

interface ChoiceGroupProps<T extends number | string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}

// Segmented buttons for a small fixed set of choices
function ChoiceGroup<T extends number | string>({ label, options, value, onChange, disabled }: ChoiceGroupProps<T>) {
  return (
    <div>
      <span className="label">{label}</span>
      <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 p-1 bg-slate-950/60 rounded-lg ring-1 ring-inset ring-slate-700/60">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={opt.value === value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`px-3 h-8 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
              opt.value === value
                ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface LeadFinderProps {
  selectedActor: Actor | null;
  onResults: (leads: Lead[]) => void;
  onProgress: (progress: { current: number; total: number; status: string }) => void;
}

export function LeadFinder({ selectedActor, onResults, onProgress }: LeadFinderProps) {
  const { executeTool, isConnecting } = useMCP();
  const [tags, setTags] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [maxResults, setMaxResults] = useState(DEFAULT_RESULTS);
  const [pages, setPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!selectedActor || tags.length === 0) return;

    setIsSearching(true);
    setError(null);
    onProgress({ current: 0, total: 1, status: 'Starting search...' });

    try {
      const input = buildSearchInput({
        queries: tags,
        countryCode,
        languageCode,
        maxPagesPerQuery: pages,
        resultsPerPage: maxResults,
      });
      onProgress({ current: 1, total: 3, status: 'Starting Apify run...' });

      // call-actor returns after at most 45 s; a longer run is polled until it finishes
      const response = await executeTool('call-actor', { actor: SEARCH_ACTOR, input, waitSecs: 45 });
      const started = readRun(response.result);
      let items: Item[];
      if (started) {
        const run = await waitForRun(executeTool, started, ({ status, elapsedSecs }) =>
          onProgress({ current: 2, total: 3, status: `Apify run ${status.toLowerCase()} · ${elapsedSecs}s` }),
        );
        if (run.status !== 'SUCCEEDED') {
          throw new Error(`Apify run ${run.status.toLowerCase()}${run.statusMessage ? `: ${run.statusMessage}` : ''}`);
        }
        if (!run.datasetId) throw new Error('Apify run finished without a dataset');
        onProgress({ current: 2, total: 3, status: 'Downloading results...' });
        items = await fetchAllItems(executeTool, run.datasetId);
      } else {
        items = extractItems(response.result);
      }

      const leads: Lead[] = normalizeSearchResults(items);
      onProgress({ current: 3, total: 3, status: `Found ${leads.length} leads` });

      onResults(leads);
    } catch (err) {
      setError(errorMessage(err, 'Search failed'));
      onProgress({ current: 0, total: 1, status: 'Error' });
    } finally {
      setIsSearching(false);
    }
  };

  const isReady = selectedActor && tags.length > 0 && !isSearching && !isConnecting;

  return (
    <div className="card">
      <h2 className="section-title mb-4">Lead Search</h2>

      {!selectedActor ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p>Select an Apify Actor from the left panel to start searching for leads.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="search-query">Search queries</label>
            <QueryTags tags={tags} onChange={setTags} disabled={isSearching} />
            <p id="query-hint" className="text-xs text-slate-500 mt-1.5">
              Press Enter after each search to add it. Backspace removes the last one.
              Using actor: <strong>{selectedActor.name}</strong>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="country">Country</label>
              <select
                id="country"
                className="input"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isSearching}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code || 'worldwide'} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="language">Language</label>
              <select
                id="language"
                className="input"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                disabled={isSearching}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <ChoiceGroup
              label="Results per query"
              options={RESULT_CHOICES.map(n => ({ value: n, label: String(n) }))}
              value={maxResults}
              onChange={setMaxResults}
              disabled={isSearching}
            />
            <ChoiceGroup
              label="Pages per query"
              options={PAGE_CHOICES.map(n => ({ value: n, label: String(n) }))}
              value={pages}
              onChange={setPages}
              disabled={isSearching}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button className="btn-secondary text-xs" onClick={handleSearch} disabled={!isReady}>
                Retry
              </button>
            </div>
          )}

          <button
            className="btn-primary w-full py-3 text-lg"
            onClick={handleSearch}
            disabled={!isReady}
          >
            {isSearching ? 'Searching...' : `Find leads${tags.length > 1 ? ` (${tags.length} queries)` : ''}`}
          </button>

          <p className="text-xs text-slate-500 text-center">
            {selectedActor.description}
          </p>
        </div>
      )}
    </div>
  );
}
