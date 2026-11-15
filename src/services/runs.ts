import type { ExecuteToolResponse } from '../types';

type Item = Record<string, unknown>;
type ToolCall = (tool: string, args: Record<string, unknown>) => Promise<ExecuteToolResponse>;

export interface ActorRun {
  runId: string;
  status: string;
  datasetId?: string;
  statusMessage?: string;
}

// Apify statuses that will not change again
const FINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

// call-actor and get-actor-run each block for at most 45 s, which stays under the tool-call timeout
const POLL_SECS = 45;
// 40 polls at 45 s is roughly 30 minutes, long enough for a large crawl
const MAX_POLLS = 40;
const PAGE_SIZE = 500;

// MCP results arrive as { content: [{ type: 'text', text }], structuredContent? }
function payloadObjects(result: unknown): Item[] {
  const out: Item[] = [];
  const structured = (result as Item | undefined)?.structuredContent;
  if (typeof structured === 'object' && structured !== null) out.push(structured as Item);
  const content = (result as Item | undefined)?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      const text = (block as Item)?.text;
      if (typeof text !== 'string') continue;
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) out.push(parsed as Item);
      } catch {
        // plain-text block, not a payload
      }
    }
  }
  if (typeof result === 'object' && result !== null) out.push(result as Item);
  return out;
}

// Apify nests storage IDs under storages; defaultDatasetId is kept as a fallback
function storageDatasetId(obj: Item): string | undefined {
  const datasets = (obj.storages as Item | undefined)?.datasets as Item | undefined;
  const dflt = datasets?.default as Item | undefined;
  return typeof dflt?.id === 'string' ? dflt.id : undefined;
}

export function readRun(result: unknown): ActorRun | null {
  for (const obj of payloadObjects(result)) {
    if (typeof obj.runId === 'string' && typeof obj.status === 'string') {
      const datasetId = storageDatasetId(obj) ?? obj.defaultDatasetId ?? obj.datasetId;
      return {
        runId: obj.runId,
        status: obj.status,
        datasetId: typeof datasetId === 'string' ? datasetId : undefined,
        statusMessage: typeof obj.statusMessage === 'string' ? obj.statusMessage : undefined,
      };
    }
  }
  return null;
}

export function isFinal(status: string): boolean {
  return FINAL_STATUSES.has(status);
}

export interface RunProgress {
  status: string;
  elapsedSecs: number;
}

// Polls get-actor-run until the run reaches a final status, then returns it
export async function waitForRun(
  call: ToolCall,
  start: ActorRun,
  onProgress: (progress: RunProgress) => void,
): Promise<ActorRun> {
  let run = start;
  let elapsedSecs = 0;
  for (let poll = 0; poll < MAX_POLLS && !isFinal(run.status); poll++) {
    onProgress({ status: run.status, elapsedSecs });
    const response = await call('get-actor-run', { runId: run.runId, waitSecs: POLL_SECS });
    const next = readRun(response.result);
    if (!next) throw new Error('Apify did not return the run status');
    run = { ...run, ...next, datasetId: next.datasetId ?? run.datasetId };
    elapsedSecs += POLL_SECS;
  }
  if (!isFinal(run.status)) {
    throw new Error(`Apify run ${run.runId} is still ${run.status} after 30 minutes. Check it in the Apify Console.`);
  }
  return run;
}

// Pages through the whole dataset; get-dataset-items returns 20 items unless a limit is given
export async function fetchAllItems(call: ToolCall, datasetId: string): Promise<Item[]> {
  const items: Item[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await call('get-dataset-items', { datasetId, offset, limit: PAGE_SIZE });
    const page = pageItems(response.result);
    items.push(...page);
    const total = pageTotal(response.result);
    if (page.length < PAGE_SIZE || (total !== undefined && offset + PAGE_SIZE >= total)) break;
  }
  return items;
}

function pageItems(result: unknown): Item[] {
  for (const obj of payloadObjects(result)) {
    if (Array.isArray(obj.items)) {
      return obj.items.filter((v): v is Item => typeof v === 'object' && v !== null);
    }
  }
  return [];
}

function pageTotal(result: unknown): number | undefined {
  for (const obj of payloadObjects(result)) {
    if (typeof obj.totalItemCount === 'number') return obj.totalItemCount;
  }
  return undefined;
}
