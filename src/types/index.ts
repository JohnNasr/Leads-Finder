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
  description?: string;
  source_actor: string;
  raw_data?: Record<string, unknown>;
}

export interface SearchParams {
  query: string;
  actor_id?: string;
  max_results?: number;
}

export interface ApiTokenResult {
  value: string | null;
}