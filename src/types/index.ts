export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ConnectionInfo {
  server_id: string;
  command: string;
  args: string[];
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  connected_at?: number;
}

export interface ExecuteToolRequest {
  server_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface ExecuteToolResponse {
  result: unknown;
  duration_ms: number;
}

export interface ConnectionEvent {
  server_id: string;
  status: string;
  reason?: string;
  timestamp: number;
  command?: string;
  args?: string[];
}

export interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  properties?: Record<string, SchemaProperty>;
}

export interface ActorInputSchema {
  type?: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export interface Actor {
  id: string;
  name: string;
  description: string;
  tool_name: string;
  input_schema?: ActorInputSchema;
}

// MCP API Types
export interface MCPHealthCheck {
  status: string;
}

export interface MCPConnectServerRequest {
  server_id: string;
  command: string;
  args: string[];
}

export interface MCPListToolsResponse {
  tools: Tool[];
}

export interface MCPConnectionInfo {
  server_id: string;
  command: string;
  args: string[];
  status: string;
  connected_at?: number;
}

export interface MCPConnectionEvent {
  server_id: string;
  status: string;
  reason?: string;
  timestamp: number;
  command?: string;
  args?: string[];
}

export interface Lead {
  id: string;
  name: string;
  type: string;
  location: string;
  website?: string;
  email?: string;
  phone?: string;
  emails?: ContactEmail[];
  phones?: string[];
  description?: string;
  source_actor: string;
  raw_data?: Record<string, unknown>;
  // Enrichment fields
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  enrichment_status?: 'pending' | 'completed' | 'failed';
  enrichment_date?: string;
  // AI outreach
  outreach_draft?: OutreachDraft;
  // ICP fit scoring
  fit_score?: FitScore;
  // Email waterfall
  email_source?: string;
  email_verified?: boolean;
  // Saved search tracking
  isNew?: boolean;
}

export interface ContactEmail {
  email: string;
  department?: 'marketing' | 'hr';
  name?: string;
  title?: string;
}

export interface OutreachDraft {
  icebreaker: string;
  subject: string;
  hook: string;
  talking_points: string[];
}

export interface FitScore {
  score: number;
  reason: string;
  tags: string[];
}

export interface SearchParams {
  query: string;
  actor_id?: string;
  max_results?: number;
}

export interface SearchOptions {
  queries: string[];
  countryCode: string;
  languageCode: string;
  maxPagesPerQuery: number;
  resultsPerPage: number;
  recency: string;
}

export interface ApiTokenResult {
  value: string | null;
}