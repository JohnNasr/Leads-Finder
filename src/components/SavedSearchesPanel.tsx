import { useState, useEffect, useCallback } from 'react';
import type { SavedSearch } from '../services/searchHistory';
import { getSavedSearches, saveSearch, deleteSavedSearch, generateSearchId } from '../services/searchHistory';
import type { Lead, SearchOptions } from '../types';

interface SavedSearchesPanelProps {
  onRunSearch: (options: SearchOptions) => void;
  currentLeads: Lead[];
  _onLeadsUpdate?: (leads: Lead[]) => void;
}

export function SavedSearchesPanel({ onRunSearch, currentLeads, _onLeadsUpdate }: SavedSearchesPanelProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSearches = useCallback(async () => {
    const searches = await getSavedSearches();
    setSavedSearches(searches);
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    const currentOptions = {
      queries: [],
      countryCode: '',
      languageCode: '',
      maxPagesPerQuery: 1,
      resultsPerPage: 50,
      recency: '',
    };
    const newSearch: SavedSearch = {
      id: generateSearchId(),
      name: saveName.trim(),
      options: currentOptions,
      createdAt: new Date().toISOString(),
      seenDomains: currentLeads.map(l => l.website ? new URL(l.website).hostname.replace('www.', '') : '').filter(Boolean),
    };
    await saveSearch(newSearch);
    setShowSaveDialog(false);
    setSaveName('');
    await loadSearches();
  };

  const handleRun = async (search: SavedSearch) => {
    setLoading(true);
    try {
      // Run the search
      onRunSearch(search.options);
      // Update last run time
      const updated = { ...search, lastRunAt: new Date().toISOString() };
      await saveSearch(updated);
      await loadSearches();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved search?')) return;
    await deleteSavedSearch(id);
    await loadSearches();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Saved Searches</h2>
        <button
          className="btn-secondary text-sm"
          onClick={() => {
            setShowSaveDialog(true);
          }}
        >
          Save Current Search
        </button>
      </div>

      {savedSearches.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          No saved searches yet. Run a search and click "Save Current Search" to save it.
        </p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {savedSearches.map(search => (
            <div key={search.id} className="p-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{search.name}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                    <span>{search.options.queries.length} quer{search.options.queries.length === 1 ? 'y' : 'ies'}</span>
                    <span>•</span>
                    <span>{search.options.countryCode || 'Worldwide'}</span>
                    <span>•</span>
                    <span>{search.options.languageCode || 'All languages'}</span>
                    {search.options.recency && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600">Recent: {search.options.recency.replace('qdr:', '')}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
                    <span>Created: {new Date(search.createdAt).toLocaleDateString()}</span>
                    {search.lastRunAt && (
                      <>
                        <span>•</span>
                        <span>Last run: {new Date(search.lastRunAt).toLocaleString()}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{search.seenDomains.length} domains tracked</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="btn-primary text-sm px-3"
                    onClick={() => handleRun(search)}
                    disabled={loading}
                  >
                    {loading ? 'Running...' : 'Run'}
                  </button>
                  <button
                    className="btn-secondary text-sm px-3 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(search.id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {search.schedule?.enabled && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Scheduled: {search.schedule.cron} ({search.schedule.timezone})</span>
                    {search.schedule.apifyScheduleId && (
                      <span className="badge badge-info text-xs">Apify: {search.schedule.apifyScheduleId}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save Search</h3>
            <input
              type="text"
              className="input mb-4"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter a name for this search"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setShowSaveDialog(false); setSaveName(''); }}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={!saveName.trim() || loading}>{loading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}