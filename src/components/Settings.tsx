import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppUpdate } from './AppUpdate';
import { ANTHROPIC_MODELS, DEFAULT_ANTHROPIC_MODEL, LLM_MODEL_KEY } from '../services/llm';

interface SettingsProps {
  onTokenSaved: () => void;
  isConnected: boolean;
}

const LLM_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'local', label: 'Local (Ollama)' },
];

export function Settings({ onTokenSaved, isConnected }: SettingsProps) {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // LLM settings
  const [llmProvider, setLlmProvider] = useState<'anthropic' | 'openai' | 'local'>('anthropic');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmSaving, setLlmSaving] = useState(false);
  const [showLlmToken, setShowLlmToken] = useState(false);
  const [llmModel, setLlmModel] = useState(DEFAULT_ANTHROPIC_MODEL);

  // ICP settings
  const [icpConfig, setIcpConfig] = useState('');
  const [icpSaved, setIcpSaved] = useState(false);
  const [icpSaving, setIcpSaving] = useState(false);

  useEffect(() => {
    loadToken();
    loadLlmSettings();
    loadIcpConfig();
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

  const loadLlmSettings = async () => {
    try {
      const [provider, key, model] = await Promise.all([
        invoke<string | null>('get_llm_provider'),
        invoke<string | null>('get_llm_api_key'),
        invoke<string | null>('get_store_value', { key: LLM_MODEL_KEY }),
      ]);
      if (provider) setLlmProvider(provider as 'anthropic' | 'openai' | 'local');
      if (model) setLlmModel(model);
      if (key) {
        setLlmApiKey(key);
        setLlmSaved(true);
      }
    } catch (err) {
      console.error('Failed to load LLM settings:', err);
    }
  };

  const loadIcpConfig = async () => {
    try {
      const stored = await invoke<string | null>('get_icp_config');
      if (stored) {
        setIcpConfig(stored);
        setIcpSaved(true);
      }
    } catch (err) {
      console.error('Failed to load ICP config:', err);
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

  const handleLlmSave = async () => {
    if (!llmApiKey.trim() && llmProvider !== 'local') return;
    setLlmSaving(true);
    try {
      await Promise.all([
        invoke('set_llm_provider', { provider: llmProvider }),
        invoke('set_llm_api_key', { key: llmApiKey.trim() }),
      ]);
      setLlmSaved(true);
    } catch (err) {
      console.error('Failed to save LLM settings:', err);
    } finally {
      setLlmSaving(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setLlmModel(model);
    try {
      await invoke('set_store_value', { key: LLM_MODEL_KEY, value: model });
    } catch (err) {
      console.error('Failed to save model:', err);
    }
  };

  const handleLlmClear = async () => {
    setLlmSaving(true);
    try {
      await invoke('set_llm_api_key', { key: '' });
      setLlmApiKey('');
      setLlmSaved(false);
    } catch (err) {
      console.error('Failed to clear LLM settings:', err);
    } finally {
      setLlmSaving(false);
    }
  };

  const handleIcpSave = async () => {
    setIcpSaving(true);
    try {
      await invoke('set_icp_config', { config: icpConfig.trim() });
      setIcpSaved(true);
    } catch (err) {
      console.error('Failed to save ICP config:', err);
    } finally {
      setIcpSaving(false);
    }
  };

  const handleIcpClear = async () => {
    setIcpSaving(true);
    try {
      await invoke('set_icp_config', { config: '' });
      setIcpConfig('');
      setIcpSaved(false);
    } catch (err) {
      console.error('Failed to clear ICP config:', err);
    } finally {
      setIcpSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="card">
        <h2 className="section-title mb-4">LLM Settings</h2>
        <p className="text-sm text-slate-500 mb-4">
          Configure an LLM provider for AI outreach drafting and ICP fit scoring.
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
            Get Anthropic API key
          </a>
        </p>

        <div className="mb-4">
          <label className="label" htmlFor="llm-provider">Provider</label>
          <select
            id="llm-provider"
            className="input"
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value as 'anthropic' | 'openai' | 'local')}
            disabled={llmSaving}
          >
            {LLM_PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="label" htmlFor="llm-api-key">
            API Key {llmProvider === 'local' && <span className="text-slate-400">(not required for local)</span>}
          </label>
          <div className="relative">
            <input
              id="llm-api-key"
              type={showLlmToken ? 'text' : 'password'}
              className="input pr-12"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder={llmSaved ? '••••••••••••••••' : llmProvider === 'local' ? 'Not required for local' : 'Enter your API key'}
              disabled={llmSaving || llmProvider === 'local'}
            />
            {llmProvider !== 'local' && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                onClick={() => setShowLlmToken(!showLlmToken)}
              >
                {showLlmToken ? (
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
            )}
          </div>
        </div>

        {llmProvider === 'anthropic' && (
          <div className="mb-4">
            <label className="label" htmlFor="llm-model">Model</label>
            <select
              id="llm-model"
              className="input"
              value={llmModel}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {ANTHROPIC_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Used for outreach drafts and ICP scoring.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={handleLlmSave}
            disabled={llmSaving || (!llmApiKey.trim() && llmProvider !== 'local')}
          >
            {llmSaving ? 'Saving...' : llmSaved ? 'Update Key' : 'Save Key'}
          </button>
          {llmSaved && (
            <button
              className="btn-secondary"
              onClick={handleLlmClear}
              disabled={llmSaving}
            >
              {llmSaving ? 'Clearing...' : 'Clear Key'}
            </button>
          )}
        </div>

        {llmSaved && (
          <p className="text-sm text-green-600 mt-3">
            ✓ LLM configured. AI outreach drafting and ICP scoring are now available.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title mb-4">ICP (Ideal Customer Profile) Configuration</h2>
        <p className="text-sm text-slate-500 mb-4">
          Describe your ideal customer profile in natural language. This will be used to score leads for fit.
          Example: "SaaS companies in Europe, 50-500 employees, using React, with $1M+ ARR"
        </p>

        <div className="mb-4">
          <label className="label" htmlFor="icp-config">ICP Description</label>
          <textarea
            id="icp-config"
            className="input min-h-[100px] resize-y"
            value={icpConfig}
            onChange={(e) => setIcpConfig(e.target.value)}
            placeholder="Describe your ideal customer..."
            disabled={icpSaving}
          />
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={handleIcpSave}
            disabled={icpSaving || !icpConfig.trim()}
          >
            {icpSaving ? 'Saving...' : icpSaved ? 'Update ICP' : 'Save ICP'}
          </button>
          {icpSaved && (
            <button
              className="btn-secondary"
              onClick={handleIcpClear}
              disabled={icpSaving}
            >
              {icpSaving ? 'Clearing...' : 'Clear ICP'}
            </button>
          )}
        </div>

        {icpSaved && (
          <p className="text-sm text-green-600 mt-3">
            ✓ ICP saved. Use "Score leads" in the Results panel to evaluate fit.
          </p>
        )}
      </div>

      <AppUpdate />
    </div>
  );
}