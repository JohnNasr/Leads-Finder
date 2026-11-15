import { useState, useEffect, useCallback } from 'react';
import { mcpService, errorMessage, toActor } from '../services/mcp';
import type { Tool, Actor, ExecuteToolResponse, MCPConnectionInfo } from '../types';

export function useMCP() {
  const [connections, setConnections] = useState<MCPConnectionInfo[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string>('apify');

  const refreshConnections = useCallback(async () => {
    try {
      const conns = await mcpService.listConnections();
      setConnections(conns);
    } catch (err) {
      console.error('Failed to list connections:', err);
    }
  }, []);

  const loadTools = useCallback(async () => {
    try {
      // The plugin gives tools/list 5s, and a cold npx start can exceed that, so retry
      let toolList: Tool[] = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          toolList = await mcpService.listTools('apify');
          break;
        } catch (err) {
          if (attempt === 3) throw err;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      setTools(toolList);
      setActors(toolList.map(toActor));
      return toolList;
    } catch (err) {
      setError(errorMessage(err, 'Could not load Apify tools'));
      throw err;
    }
  }, []);

  const connectToApify = useCallback(async (apiToken: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      await mcpService.connectApify(apiToken);
      await refreshConnections();
      await loadTools();
    } catch (err) {
      setError(errorMessage(err, 'Failed to connect to Apify MCP server'));
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshConnections, loadTools]);

  const disconnect = useCallback(async (serverId: string) => {
    try {
      await mcpService.disconnectServer(serverId);
      await refreshConnections();
      if (serverId === 'apify') {
        setTools([]);
        setActors([]);
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }, [refreshConnections]);

  const executeTool = useCallback(async (toolName: string, args: Record<string, unknown>): Promise<ExecuteToolResponse> => {
    return mcpService.executeTool({
      server_id: 'apify',
      tool_name: toolName,
      arguments: args,
    });
  }, []);

  useEffect(() => {
    refreshConnections();

    let unlistenConnectedFn: (() => void) | null = null;
    let unlistenDisconnectedFn: (() => void) | null = null;

    mcpService.onServerConnected((event) => {
      console.log('Server connected:', event);
      refreshConnections();
    }).then(fn => { unlistenConnectedFn = fn; });

    mcpService.onServerDisconnected((event) => {
      console.log('Server disconnected:', event);
      refreshConnections();
    }).then(fn => { unlistenDisconnectedFn = fn; });

    return () => {
      if (unlistenConnectedFn) unlistenConnectedFn();
      if (unlistenDisconnectedFn) unlistenDisconnectedFn();
    };
  }, [refreshConnections]);

  return {
    connections,
    tools,
    actors,
    isConnecting,
    error,
    selectedServerId,
    setSelectedServerId,
    connectToApify,
    loadTools,
    disconnect,
    executeTool,
    refreshConnections,
  };
}