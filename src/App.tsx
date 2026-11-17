import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMCP } from './hooks/useMCP';
import { ActorSelector } from './components/ActorSelector';
import { LeadFinder } from './components/LeadFinder';
import { ResultsTable } from './components/ResultsTable';
import { Settings } from './components/Settings';
import { UpdateBanner } from './components/UpdateBanner';
import type { Actor, Lead, SearchOptions } from './types';
import { normalizeSearchResults, SEARCH_ACTOR } from './services/leads';
import { fetchAllItems, readRun, waitForRun } from './services/runs';
import { buildExport, EXPORT_OPTIONS, type ExportFormat } from './services/exporters';
import logoUrl from './assets/logo.png';

type Tab = 'actors' | 'search' | 'results' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('actors');
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [, setTokenSaved] = useState(false);
  const { executeTool, isConnecting } = useMCP();

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const checkToken = useCallback(async () => {
    try {
      const result = await invoke<string | null>('get_api_token');
      setTokenSaved(!!result);
    } catch (err) {
      console.error('Failed to check token:', err);
    }
  }, []);

  const handleTokenSaved = useCallback(() => {
    checkToken();
  }, [checkToken]);

  const handleActorSelect = useCallback((actor: Actor) => {
    setSelectedActor(actor);
    setActiveTab('search');
  }, []);

  const handleResults = useCallback((newLeads: Lead[]) => {
    setLeads(newLeads);
    setActiveTab('results');
    setSearchProgress(null);
  }, []);

  const handleLeadsUpdate = useCallback((newLeads: Lead[]) => {
    setLeads(newLeads);
  }, []);

  const handleRunSavedSearch = useCallback(async (options: SearchOptions) => {
    if (!executeTool) return;
    setActiveTab('results');
    setSearchProgress({ current: 0, total: 3, status: 'Starting search...' });

    try {
      const input = {
        queries: options.queries.join('\n'),
        languageCode: options.languageCode,
        maxPagesPerQuery: options.maxPagesPerQuery,
        resultsPerPage: options.resultsPerPage,
      };
      if (options.countryCode) (input as Record<string, unknown>).countryCode = options.countryCode;
      if (!options.languageCode) delete (input as Record<string, unknown>).languageCode;
      if (options.recency) (input as Record<string, unknown>).tbs = options.recency;

      setSearchProgress({ current: 1, total: 3, status: 'Starting Apify run...' });
      const response = await executeTool('call-actor', { actor: SEARCH_ACTOR, input, waitSecs: 45 });
      const started = readRun(response.result);
      let items: Record<string, unknown>[];
      if (started) {
        const run = await waitForRun(executeTool, started, ({ status, elapsedSecs }) =>
          setSearchProgress({ current: 2, total: 3, status: `Apify run ${status.toLowerCase()} · ${elapsedSecs}s` }),
        );
        if (run.status !== 'SUCCEEDED') {
          throw new Error(`Apify run ${run.status.toLowerCase()}${run.statusMessage ? `: ${run.statusMessage}` : ''}`);
        }
        if (!run.datasetId) throw new Error('Apify run finished without a dataset');
        setSearchProgress({ current: 2, total: 3, status: 'Downloading results...' });
        items = await fetchAllItems(executeTool, run.datasetId);
      } else {
        // Extract items from direct result
        const result = response.result as Record<string, unknown>;
        items = (result.items as Record<string, unknown>[]) || [];
      }

      const newLeads: Lead[] = normalizeSearchResults(items);
      setSearchProgress({ current: 3, total: 3, status: `Found ${newLeads.length} leads` });
      handleResults(newLeads);
    } catch (err) {
      console.error('Saved search failed:', err);
      setSearchProgress({ current: 0, total: 1, status: 'Error' });
    }
  }, [executeTool, handleResults]);

  const handleProgress = useCallback((progress: { current: number; total: number; status: string }) => {
    setSearchProgress(progress);
    if (progress.current === progress.total && progress.total > 1) {
      // Show notification when search completes with results (approximate count)
      invoke('plugin:notification|send', {
        title: 'Search Complete',
        body: `Search completed`,
      }).catch(() => {}); // Ignore notification errors
    }
  }, []);

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = normalizeSearchResults(JSON.parse(await file.text()));
      if (imported.length === 0) throw new Error('no organic results found');
      handleResults(imported);
    } catch {
      setSearchProgress({ current: 0, total: 1, status: 'Import failed: not a Google Search dataset' });
    }
  }, [handleResults]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    const file = buildExport(leads, format);
    try {
      await invoke('plugin:dialog|save_file', {
        filters: [{ name: format.toUpperCase(), extensions: [file.filename.split('.').pop() || ''] }],
        defaultPath: file.filename,
      });
      // After user selects path, we need to write the file
      // Note: The dialog plugin doesn't return the path in Tauri v2 the same way
      // For now, fall back to download
      downloadFile(file.content, file.filename, file.type);
    } catch {
      downloadFile(file.content, file.filename, file.type);
    }
  }, [leads]);

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: 'actors', label: 'Actors' },
    { id: 'search', label: 'Search', disabled: !selectedActor },
    { id: 'results', label: `Results (${leads.length})` },
    { id: 'settings', label: 'Settings' },
  ];

  const hasAside = activeTab === 'search' || (activeTab === 'results' && leads.length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <div aria-hidden="true" className="ambient">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
      </div>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 py-4">
              <img src={logoUrl} alt="" aria-hidden="true" className="brand-logo w-10 h-10 rounded-xl shrink-0" />
              <div className="leading-tight">
                <h1 className="text-base font-bold tracking-tight text-gradient">Business Lead Finder</h1>
                <p className="text-xs text-slate-500">Lead discovery via Apify</p>
              </div>
            </div>

            <nav className="flex items-stretch gap-2" aria-label="Main">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className="tab-link"
                  onClick={() => setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {searchProgress && (
            <div className="pb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-600">{searchProgress.status}</span>
                <span className="text-slate-500 tabular-nums">{searchProgress.current}/{searchProgress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="progress-fill h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>
      <UpdateBanner />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className={`grid grid-cols-1 gap-6 ${hasAside ? 'lg:grid-cols-4' : ''}`}>
          {hasAside && (
          <aside className="lg:col-span-1 space-y-6">
            {activeTab === 'search' && selectedActor && (
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Selected actor</p>
                <div className="p-4 bg-blue-50/70 ring-1 ring-inset ring-blue-100 rounded-xl">
                  <p className="font-medium text-blue-950">{selectedActor.name}</p>
                  <p className="text-sm text-blue-800/80 mt-1">{selectedActor.description}</p>
                  <p className="text-xs text-blue-600 mt-2 font-mono break-all">{selectedActor.tool_name}</p>
                </div>
                <button
                  className="btn-secondary w-full mt-4"
                  onClick={() => setActiveTab('actors')}
                >
                  ← Change actor
                </button>
              </div>
            )}
            {activeTab === 'results' && leads.length > 0 && (
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Export</p>
                <p className="text-sm text-slate-600 mb-4">
                  <span className="font-semibold text-slate-900 tabular-nums">{leads.length}</span> leads ready to export
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_OPTIONS.map(opt => (
                    <button key={opt.id} className="btn-secondary justify-start" onClick={() => handleExport(opt.id)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-5 pt-5">
                  <button
                    className="btn w-full text-red-600 hover:bg-red-50 border border-transparent"
                    onClick={() => {
                      setLeads([]);
                      setSelectedActor(null);
                      setActiveTab('actors');
                    }}
                  >
                    Clear results & start over
                  </button>
                </div>
              </div>
            )}
          </aside>
          )}

          <div key={activeTab} className={`${hasAside ? 'lg:col-span-3' : ''} space-y-6 min-w-0`}>
            {activeTab === 'actors' && (
              <ActorSelector
                onActorSelect={handleActorSelect}
                selectedActor={selectedActor}
                onRunSearch={handleRunSavedSearch}
                currentLeads={leads}
                onLeadsUpdate={handleLeadsUpdate}
              />
            )}
            {activeTab === 'search' && (
              <LeadFinder
                selectedActor={selectedActor}
                onResults={handleResults}
                onProgress={handleProgress}
              />
            )}
            {activeTab === 'results' && (
              <>
                <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
                  <p className="text-sm text-slate-600">Import a Google Search dataset exported from Apify</p>
                  <label className="btn-secondary cursor-pointer">
                    Import dataset
                    <input type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
                  </label>
                </div>
                <ResultsTable
                  leads={leads}
                  onExport={handleExport}
                  onLeadsUpdate={handleLeadsUpdate}
                  executeTool={executeTool}
                />
              </>
            )}
            {activeTab === 'settings' && (
              <Settings
                onTokenSaved={handleTokenSaved}
                isConnected={isConnecting}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default App;
