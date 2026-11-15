import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsProps {
  onTokenSaved: () => void;
  isConnected: boolean;
}

export function Settings({ onTokenSaved, isConnected }: SettingsProps) {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const stored = await invoke<string | null>('get_api_token');
      if (stored) {
        setToken(stored);
        setSaved(true);
      }
    } catch (err) {
      console.error('Failed to load token:', err);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await invoke('set_api_token', { token: token.trim() });
      setSaved(true);
      onTokenSaved();
    } catch (err) {
      console.error('Failed to save token:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await invoke('set_api_token', { token: '' });
      setToken('');
      setSaved(false);
      onTokenSaved();
    } catch (err) {
      console.error('Failed to clear token:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="section-title mb-4">Apify API Token</h2>
      
      <div className="mb-4">
        <label className="label" htmlFor="apify-token">API Token</label>
        <div className="relative">
          <input
            id="apify-token"
            type={showToken ? 'text' : 'password'}
            className="input pr-12"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={saved ? '••••••••••••••••' : 'Enter your Apify API token'}
            disabled={isConnected}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Get your token at <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Apify Console → Integrations</a>
        </p>
      </div>

      <div className="flex gap-3">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !token.trim() || isConnected}
        >
          {saving ? 'Saving...' : saved ? 'Update Token' : 'Save Token'}
        </button>
        {saved && !isConnected && (
          <button
            className="btn-secondary"
            onClick={handleClear}
            disabled={saving}
          >
            {saving ? 'Clearing...' : 'Clear Token'}
          </button>
        )}
      </div>

      {saved && !isConnected && (
        <p className="text-sm text-green-600 mt-3">
          ✓ Token saved. Connect to Apify MCP server from the Actor Selector tab.
        </p>
      )}

      {isConnected && (
        <p className="text-sm text-blue-600 mt-3">
          ✓ Connected to Apify MCP server. Token cannot be changed while connected.
        </p>
      )}
    </div>
  );
}