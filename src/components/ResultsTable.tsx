import { useState, useMemo } from 'react';
import type { Lead } from '../types';
import { EXPORT_OPTIONS, type ExportFormat } from '../services/exporters';

interface ResultsTableProps {
  leads: Lead[];
  onExport: (format: ExportFormat) => void;
}

export function ResultsTable({ leads, onExport }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof Lead>>(new Set([
    'name', 'type', 'location', 'website', 'email', 'source_actor'
  ]));

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
    { key: 'description', label: 'Description', render: (lead) => lead.description ? (
      <span className="truncate block max-w-md" title={lead.description}>{lead.description}</span>
    ) : <span className="text-slate-400">—</span> },
    { key: 'source_actor', label: 'Source Actor', render: (lead) => <span className="text-xs font-mono text-slate-500">{lead.source_actor}</span> },
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
        lead.description?.toLowerCase().includes(search)
      );
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key] as string | undefined;
        const bVal = b[sortConfig.key] as string | undefined;
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

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <h2 className="section-title">Results ({leads.length})</h2>
          {selectedLeads.size > 0 && (
            <span className="badge badge-info">{selectedLeads.size} selected</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
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
        </div>
      </div>

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
    </div>
  );
}