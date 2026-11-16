import { useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Lead, OutreachDraft } from '../types';
import { EXPORT_OPTIONS, type ExportFormat } from '../services/exporters';
import { enrichLeads } from '../services/enrichment';
import { generateOutreachDraft } from '../services/outreach';
import { scoreLeads } from '../services/icp';

interface ResultsTableProps {
  leads: Lead[];
  onExport: (format: ExportFormat) => void;
  onLeadsUpdate: (leads: Lead[]) => void;
  // executeTool reserved for future email waterfall feature
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _executeTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
}

export function ResultsTable({ leads, onExport, onLeadsUpdate, _executeTool }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof Lead>>(new Set([
    'name', 'type', 'location', 'website', 'email', 'phone', 'fit_score', 'source_actor'
  ]));
  const [enriching, setEnriching] = useState<Set<string>>(new Set());
  const [enrichmentProgress, setEnrichmentProgress] = useState<{ current: number; total: number } | null>(null);
  const [scoring, setScoring] = useState<Set<string>>(new Set());
  const [scoringProgress, setScoringProgress] = useState<{ current: number; total: number } | null>(null);
  const [draftingLead, setDraftingLead] = useState<Lead | null>(null);
  const [outreachDraft, setOutreachDraft] = useState<OutreachDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const allColumns: { key: keyof Lead; label: string; render: (lead: Lead) => React.ReactNode }[] = [
    { key: 'name', label: 'Name', render: (lead) => <span className="font-medium">{lead.name}</span> },
    { key: 'type', label: 'Type', render: (lead) => <span className="badge badge-info">{lead.type}</span> },
    { key: 'location', label: 'Location', render: (lead) => <span>{lead.location}</span> },
    { key: 'website', label: 'Website', render: (lead) => lead.website ? (
      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs">
        {lead.website}
      </a>
    ) : <span className="text-slate-400">—</span> },
    { key: 'email', label: 'Email', render: (lead) => lead.email ? (
      <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
    ) : <span className="text-slate-400">—</span> },
    { key: 'phone', label: 'Phone', render: (lead) => lead.phone ? <span>{lead.phone}</span> : <span className="text-slate-400">—</span> },
    { key: 'linkedin', label: 'LinkedIn', render: (lead) => lead.linkedin ? (
      <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">LinkedIn</a>
    ) : <span className="text-slate-400">—</span> },
    { key: 'twitter', label: 'Twitter', render: (lead) => lead.twitter ? (
      <a href={lead.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Twitter</a>
    ) : <span className="text-slate-400">—</span> },
    { key: 'facebook', label: 'Facebook', render: (lead) => lead.facebook ? (
      <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Facebook</a>
    ) : <span className="text-slate-400">—</span> },
    { key: 'fit_score', label: 'Fit', render: (lead) => {
      if (!lead.fit_score) return <span className="text-slate-400">—</span>;
      const score = lead.fit_score.score;
      let color = 'bg-red-500';
      let label = 'Poor';
      if (score >= 80) { color = 'bg-green-500'; label = 'Excellent'; }
      else if (score >= 60) { color = 'bg-yellow-500'; label = 'Good'; }
      else if (score >= 40) { color = 'bg-orange-500'; label = 'Fair'; }
      return (
        <div className="flex items-center gap-2">
          <div className={`w-20 h-4 rounded bg-slate-200 overflow-hidden`}>
            <div className={`${color} h-full transition-all duration-300`} style={{ width: `${score}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-600">{score}</span>
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      );
    }},
    { key: 'description', label: 'Description', render: (lead) => lead.description ? (
      <span className="truncate block max-w-md" title={lead.description}>{lead.description}</span>
    ) : <span className="text-slate-400">—</span> },
    { key: 'source_actor', label: 'Source Actor', render: (lead) => <span className="text-xs font-mono text-slate-500">{lead.source_actor}</span> },
    { key: 'enrichment_status', label: 'Enrichment', render: (lead) => {
      if (!lead.website) return <span className="text-slate-400">No website</span>;
      if (enriching.has(lead.id)) return (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-blue-600">Enriching...</span>
        </div>
      );
      switch (lead.enrichment_status) {
        case 'completed':
          return <span className="badge badge-success">Done</span>;
        case 'failed':
          return <span className="badge badge-error">Failed</span>;
        default:
          return <span className="text-slate-400">Not enriched</span>;
      }
    }},
  ];

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterText) {
      const search = filterText.toLowerCase();
      result = result.filter(lead =>
        lead.name.toLowerCase().includes(search) ||
        lead.type.toLowerCase().includes(search) ||
        lead.location.toLowerCase().includes(search) ||
        lead.website?.toLowerCase().includes(search) ||
        lead.email?.toLowerCase().includes(search) ||
        lead.description?.toLowerCase().includes(search) ||
        lead.linkedin?.toLowerCase().includes(search) ||
        lead.twitter?.toLowerCase().includes(search)
      );
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key] as string | number | undefined;
        const bVal = b[sortConfig.key] as string | number | undefined;
        if (aVal === bVal) return 0;
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [leads, filterText, sortConfig]);

  const handleSort = (key: keyof Lead) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleColumn = (key: keyof Lead) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportVisible = (format: ExportFormat) => {
    onExport(format);
  };

  const handleEnrichAll = useCallback(async () => {
    const leadsToEnrich = leads.filter(l => l.website && l.enrichment_status !== 'completed');
    if (leadsToEnrich.length === 0) return;

    setEnrichmentProgress({ current: 0, total: leadsToEnrich.length });
    setEnriching(new Set(leadsToEnrich.map(l => l.id)));

    try {
      const enriched = await enrichLeads(leads);
      onLeadsUpdate(enriched);
    } catch (err) {
      console.error('Enrichment failed:', err);
      const failedLeads = leads.map(lead => 
        leadsToEnrich.some(l => l.id === lead.id)
          ? { ...lead, enrichment_status: 'failed' as const }
          : lead
      );
      onLeadsUpdate(failedLeads);
    } finally {
      setEnriching(new Set());
      setEnrichmentProgress(null);
    }
  }, [leads, onLeadsUpdate]);

  const handleScoreAll = useCallback(async () => {
    const icpConfig = await invoke<string | null>('get_icp_config');
    if (!icpConfig) {
      alert('Please configure your ICP in Settings first.');
      return;
    }
    const llmApiKey = await invoke<string | null>('get_llm_api_key');
    const llmProvider = await invoke<string | null>('get_llm_provider') || 'anthropic';
    if (!llmApiKey && llmProvider !== 'local') {
      alert('Please configure your LLM API key in Settings first.');
      return;
    }

    const leadsToScore = leads.filter(l => l.website && !l.fit_score);
    if (leadsToScore.length === 0) return;

    setScoringProgress({ current: 0, total: leadsToScore.length });
    setScoring(new Set(leadsToScore.map(l => l.id)));

    try {
      const scored = await scoreLeads(leads, icpConfig, llmApiKey || '', llmProvider as 'anthropic' | 'openai');
      onLeadsUpdate(scored);
    } catch (err) {
      console.error('Scoring failed:', err);
    } finally {
      setScoring(new Set());
      setScoringProgress(null);
    }
  }, [leads, onLeadsUpdate]);

  const handleDraftOutreach = useCallback(async (lead: Lead) => {
    const llmApiKey = await invoke<string | null>('get_llm_api_key');
    const llmProvider = await invoke<string | null>('get_llm_provider') || 'anthropic';
    if (!llmApiKey && llmProvider !== 'local') {
      alert('Please configure your LLM API key in Settings first.');
      return;
    }

    setDraftingLead(lead);
    setDraftLoading(true);
    setOutreachDraft(null);

    try {
      const draft = await generateOutreachDraft(lead, llmApiKey || '', llmProvider as 'anthropic' | 'openai');
      setOutreachDraft(draft);
    } catch (err) {
      console.error('Outreach draft failed:', err);
      alert('Failed to generate outreach draft. Check console for details.');
    } finally {
      setDraftLoading(false);
    }
  }, []);

  const closeDraftPanel = useCallback(() => {
    setDraftingLead(null);
    setOutreachDraft(null);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="card relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <h2 className="section-title">Results ({leads.length})</h2>
          {selectedLeads.size > 0 && (
            <span className="badge badge-info">{selectedLeads.size} selected</span>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <input
              type="text"
              className="input pl-10 w-64"
              placeholder="Filter results..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="relative group">
            <button className="btn-secondary">Columns</button>
            <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg py-2 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {allColumns.map(col => (
                <label key={col.key} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="relative group">
            <button className="btn-secondary" aria-haspopup="menu">Export as</button>
            <div role="menu" className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
              {EXPORT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  role="menuitem"
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => exportVisible(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="btn-primary"
            onClick={handleEnrichAll}
            disabled={leads.filter(l => l.website && l.enrichment_status !== 'completed').length === 0 || enriching.size > 0}
          >
            {enriching.size > 0 ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Enriching ({enrichmentProgress?.current || 0}/{enrichmentProgress?.total || 0})
              </>
            ) : 'Enrich contacts'}
          </button>

          <button 
            className="btn-secondary"
            onClick={handleScoreAll}
            disabled={leads.filter(l => l.website && !l.fit_score).length === 0 || scoring.size > 0}
          >
            {scoring.size > 0 ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Scoring ({scoringProgress?.current || 0}/{scoringProgress?.total || 0})
              </>
            ) : 'Score leads'}
          </button>
        </div>
      </div>

      {enrichmentProgress && (
        <div className="mb-4">
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="progress-fill h-1.5 rounded-full transition-all duration-300 bg-blue-500"
              style={{ width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {scoringProgress && (
        <div className="mb-4">
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="progress-fill h-1.5 rounded-full transition-all duration-300 bg-purple-500"
              style={{ width: `${(scoringProgress.current / scoringProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No leads found. Search for institutions using the Lead Finder panel.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {allColumns
                    .filter(col => visibleColumns.has(col.key))
                    .map(col => (
                      <th key={col.key} className="cursor-pointer select-none" onClick={() => handleSort(col.key)}>
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {sortConfig?.key === col.key && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortConfig.direction === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                            </svg>
                          )}
                        </div>
                      </th>
                    ))}
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    {allColumns
                      .filter(col => visibleColumns.has(col.key))
                      .map(col => (
                        <td key={col.key}>{col.render(lead)}</td>
                      ))}
                    <td className="flex items-center gap-2">
                      {lead.website && lead.enrichment_status !== 'completed' && !enriching.has(lead.id) && (
                        <button
                          className="btn-secondary text-xs py-1 px-2"
                          onClick={() => handleEnrichAll()} // For now, enrich all
                          disabled={enriching.size > 0}
                          title="Enrich this lead"
                        >
                          Enrich
                        </button>
                      )}
                      {lead.website && !lead.fit_score && !scoring.has(lead.id) && (
                        <button
                          className="btn-secondary text-xs py-1 px-2"
                          onClick={() => handleScoreAll()} // For now, score all
                          disabled={scoring.size > 0}
                          title="Score this lead"
                        >
                          Score
                        </button>
                      )}
                      {lead.website && (
                        <button
                          className="btn-primary text-xs py-1 px-2"
                          onClick={() => handleDraftOutreach(lead)}
                          disabled={draftLoading}
                          title="Draft outreach"
                        >
                          {draftLoading && draftingLead?.id === lead.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          ) : 'Draft'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>Showing {filteredLeads.length} of {leads.length} leads</span>
          </div>
        </>
      )}

      {/* Outreach Draft Slide-over Panel */}
      {draftingLead && outreachDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 sm:p-0" onClick={closeDraftPanel}>
          <div className="w-full sm:w-96 bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl">
              <div>
                <h3 className="font-semibold text-slate-900">Outreach Draft</h3>
                <p className="text-sm text-slate-500">{draftingLead.name}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1" onClick={closeDraftPanel}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="label">Icebreaker</label>
                <div className="flex items-center gap-2">
                  <p className="text-slate-700 flex-1">{outreachDraft.icebreaker}</p>
                  <button className="btn-secondary text-xs" onClick={() => copyToClipboard(outreachDraft.icebreaker)}>Copy</button>
                </div>
              </div>
              <div>
                <label className="label">Subject Line</label>
                <div className="flex items-center gap-2">
                  <p className="text-slate-700 font-medium flex-1">{outreachDraft.subject}</p>
                  <button className="btn-secondary text-xs" onClick={() => copyToClipboard(outreachDraft.subject)}>Copy</button>
                </div>
              </div>
              <div>
                <label className="label">Hook</label>
                <div className="flex items-center gap-2">
                  <p className="text-slate-700 flex-1">{outreachDraft.hook}</p>
                  <button className="btn-secondary text-xs" onClick={() => copyToClipboard(outreachDraft.hook)}>Copy</button>
                </div>
              </div>
              <div>
                <label className="label">Talking Points</label>
                <div className="space-y-2">
                  {outreachDraft.talking_points.map((point, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-700 flex-1">{idx + 1}. {point}</span>
                      <button className="btn-secondary text-xs" onClick={() => copyToClipboard(point)}>Copy</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Lead data sent to Anthropic for drafting. 
                  <a href="#" className="text-blue-600 hover:underline">Privacy</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}