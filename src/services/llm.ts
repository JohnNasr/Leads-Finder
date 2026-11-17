import { Anthropic } from '@anthropic-ai/sdk';
import { invoke } from '@tauri-apps/api/core';

export const LLM_MODEL_KEY = 'llm_model';

export const ANTHROPIC_MODELS = [
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';

export function anthropicClient(apiKey: string): Anthropic {
  // Runs in the local Tauri webview; the key is stored on this machine only
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function loadLlmModel(): Promise<string> {
  const stored = await invoke<string | null>('get_store_value', { key: LLM_MODEL_KEY });
  return stored || DEFAULT_ANTHROPIC_MODEL;
}

// Newer models can put thinking blocks before the answer, so read every text block
export function replyText(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
}

// Models may add prose or a code fence around the JSON, so take the outermost object
export function parseJsonReply<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('No JSON object in reply');
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replace(`{${key}}`, () => value),
    template,
  );
}
