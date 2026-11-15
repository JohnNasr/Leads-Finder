import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMCP } from '../hooks/useMCP';
import { mcpService } from '../services/mcp';
import { SUGGESTED_ACTORS, matchesActor } from '../services/actors';
import type { Actor } from '../types';

interface ActorSelectorProps {
  onActorSelect: (actor: Actor) => void;
  selectedActor: Actor | null;
}

interface ActorButtonProps {
  actor: Actor;
  selected: boolean;
  onSelect: (actor: Actor) => void;
}

function ActorButton({ actor, selected, onSelect }: ActorButtonProps) {
  return (
    <button
      className={`lift w-full text-left p-4 rounded-xl border ${
        selected
          ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-violet-50 ring-1 ring-blue-500/20'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
      onClick={() => onSelect(actor)}
      aria-pressed={selected}
    >
      <div className="font-medium text-slate-900">{actor.name}</div>
      <div className="text-sm text-slate-500 mt-1 line-clamp-2">{actor.description}</div>
      <div className="text-xs text-slate-400 mt-2 font-mono break-all">{actor.tool_name}</div>
    </button>
  );
}

export function ActorSelector({ onActorSelect, selectedActor }: ActorSelectorProps) {
  const { actors, isConnecting, error, connectToApify, disconnect, connections, loadTools } = useMCP();
  const [searchTerm, setSearchTerm] = useState('');
  const [apiToken, setApiToken] = useState('');

  const isApifyConnected = connections.some(c => c.server_id === 'apify' && c.status === 'connected');

  useEffect(() => {
    let cancelled = false;
    const autoConnect = async () => {
      const saved = await invoke<string | null>('get_api_token');
      const conns = await mcpService.listConnections();
      const alreadyConnected = conns.some(c => c.server_id === 'apify' && c.status === 'connected');
      if (cancelled) return;
      // A server that survived a UI reload has no tool list yet, so fetch it directly
      if (alreadyConnected) {
        await loadTools().catch(() => undefined);
      } else if (saved) {
        await connectToApify(saved).catch(() => undefined);
      }
    };
    autoConnect().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [connectToApify, loadTools]);

  const handleConnect = async () => {
    if (!apiToken.trim()) return;
    try {
      await connectToApify(apiToken.trim());
      setApiToken('');
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = async () => {
    await disconnect('apify');
  };

  const visibleSuggested = SUGGESTED_ACTORS.filter(actor => matchesActor(actor, searchTerm));
  const visibleDiscovered = actors.filter(actor => matchesActor(actor, searchTerm));

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10l8 4 8-4V7M4 7l8 4m0 0l8-4m-8 4v10" />
              </svg>
            </div>
            <div>
              <h2 className="section-title">Apify connection</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {isApifyConnected ? `Connected · ${actors.length} tools available` : 'Connect to run actors and load the full catalogue.'}
              </p>
            </div>
          </div>
          {isApifyConnected ? (
            <div className="flex items-center gap-3">
              <span className="badge badge-success">Connected</span>
              <button className="btn-secondary" onClick={handleDisconnect}>Disconnect</button>
            </div>
          ) : (
            <span className="badge badge-warning">Not connected</span>
          )}
        </div>

        {!isApifyConnected && (
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              id="api-token"
              type="password"
              className="input"
              aria-label="Apify API token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Paste your Apify API token"
              disabled={isConnecting}
            />
            <button
              className="btn-primary sm:w-56"
              onClick={handleConnect}
              disabled={isConnecting || !apiToken.trim()}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        )}
        {!isApifyConnected && (
          <p className="text-xs text-slate-500 mt-2">
            Get your token at <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Apify Console</a>
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <h2 className="section-title">Actors</h2>
          <div className="relative sm:w-72">
            <input
              type="text"
              className="input pl-10"
              aria-label="Search actors"
              placeholder="Search actors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Suggested</p>
        {visibleSuggested.length === 0 ? (
          <p className="text-sm text-slate-500 mb-6">No suggested actors match your search.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 mb-6">
            {visibleSuggested.map(actor => (
              <ActorButton
                key={actor.id}
                actor={actor}
                selected={selectedActor?.id === actor.id}
                onSelect={onActorSelect}
              />
            ))}
          </div>
        )}

        {isApifyConnected && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">From Apify MCP</p>
            {visibleDiscovered.length === 0 ? (
              <p className="text-sm text-slate-500">No tools match your search.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 max-h-96 overflow-y-auto pr-1">
                {visibleDiscovered.map(actor => (
                  <ActorButton
                    key={actor.id}
                    actor={actor}
                    selected={selectedActor?.id === actor.id}
                    onSelect={onActorSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
