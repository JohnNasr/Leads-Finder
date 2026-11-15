import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  Tool,
  ExecuteToolRequest,
  ExecuteToolResponse,
  Actor,
  MCPListToolsResponse,
  MCPConnectionInfo,
  MCPConnectionEvent,
} from '../types';

export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err) return err;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// Rust's Command cannot launch the `npx` batch shim on Windows without the extension
const NPX = /windows/i.test(navigator.userAgent) ? 'npx.cmd' : 'npx';

export interface MCPService {
  healthCheck(): Promise<{ status: string }>;
  connectApify(token: string): Promise<void>;
  disconnectServer(serverId: string): Promise<void>;
  listConnections(): Promise<MCPConnectionInfo[]>;
  listTools(serverId: string): Promise<Tool[]>;
  executeTool(request: ExecuteToolRequest): Promise<ExecuteToolResponse>;
  onServerConnected(callback: (event: MCPConnectionEvent) => void): Promise<() => void>;
  onServerDisconnected(callback: (event: MCPConnectionEvent) => void): Promise<() => void>;
  onConnectionChanged(callback: (event: MCPConnectionEvent) => void): Promise<() => void>;
  onProcessError(callback: (event: MCPConnectionEvent) => void): Promise<() => void>;
}

class MCPServiceImpl implements MCPService {
  async healthCheck() {
    return invoke<{ status: string }>('plugin:mcp-client|health_check');
  }

  async connectApify(token: string) {
    // The plugin spawns the server with the app's environment, so the token is set there first
    await invoke<void>('set_apify_env', { token });
    await invoke<string>('plugin:mcp-client|plugin_connect_server', {
      request: { server_id: 'apify', command: NPX, args: ['-y', '@apify/actors-mcp-server'] },
    });
  }

  async disconnectServer(serverId: string) {
    await invoke<string>('plugin:mcp-client|plugin_disconnect_server', { serverId });
  }

  async listConnections() {
    return invoke<MCPConnectionInfo[]>('plugin:mcp-client|get_connection_statuses');
  }

  async listTools(serverId: string) {
    const response = await invoke<MCPListToolsResponse>('plugin:mcp-client|plugin_list_tools', { serverId });
    return response.tools || [];
  }

  async executeTool(request: ExecuteToolRequest) {
    return invoke<ExecuteToolResponse>('plugin:mcp-client|plugin_execute_tool', { request });
  }

  onServerConnected(callback: (event: MCPConnectionEvent) => void) {
    return listen<MCPConnectionEvent>('mcp://server-connected', (e) => callback(e.payload));
  }

  onServerDisconnected(callback: (event: MCPConnectionEvent) => void) {
    return listen<MCPConnectionEvent>('mcp://server-disconnected', (e) => callback(e.payload));
  }

  onConnectionChanged(callback: (event: MCPConnectionEvent) => void) {
    return listen<MCPConnectionEvent>('mcp://connection-changed', (e) => callback(e.payload));
  }

  onProcessError(callback: (event: MCPConnectionEvent) => void) {
    return listen<MCPConnectionEvent>('mcp://process-error', (e) => callback(e.payload));
  }

  async getApifyActors(): Promise<Actor[]> {
    const tools = await this.listTools('apify');
    return tools.map(toActor);
  }
}

export function toActor(tool: Tool): Actor {
  return {
    id: tool.name,
    name: tool.name.replace(/^apify[_-]/, '').replace(/[_-]/g, ' '),
    description: tool.description || '',
    tool_name: tool.name,
    input_schema: tool.inputSchema || {},
  };
}

export const mcpService = new MCPServiceImpl();
