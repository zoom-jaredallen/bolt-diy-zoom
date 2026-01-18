import { spawn, type ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { experimental_createMCPClient, type ToolSet } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import type { StdioConfig, MCPSession, ToolInfo, SessionStatus } from './types.js';

interface ManagedProcess {
  process: ChildProcess | null;
  client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null;
  session: MCPSession;
  tools: ToolSet;
}

/**
 * ProcessManager handles the lifecycle of stdio MCP server processes
 */
export class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private serverNameToSessionId: Map<string, string> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes inactivity timeout

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupInactiveSessions(), 60 * 1000);
  }

  /**
   * Spawn a new stdio MCP server process
   */
  async spawn(serverName: string, config: StdioConfig): Promise<MCPSession> {
    // Check if server already exists
    const existingSessionId = this.serverNameToSessionId.get(serverName);
    if (existingSessionId) {
      const existing = this.processes.get(existingSessionId);
      if (existing && existing.session.status === 'running') {
        existing.session.lastActivity = new Date();
        return existing.session;
      }
      // Clean up stale session
      await this.close(existingSessionId);
    }

    const sessionId = uuidv4();
    const now = new Date();

    const session: MCPSession = {
      sessionId,
      serverName,
      status: 'starting',
      startedAt: now,
      lastActivity: now,
    };

    const managed: ManagedProcess = {
      process: null,
      client: null,
      session,
      tools: {},
    };

    this.processes.set(sessionId, managed);
    this.serverNameToSessionId.set(serverName, sessionId);

    try {
      console.log(`[ProcessManager] Spawning ${serverName}: ${config.command} ${config.args?.join(' ') || ''}`);

      // Merge custom env with process.env (custom env takes precedence)
      // This ensures child processes have PATH, HOME, NODE_PATH etc. plus any custom vars
      const mergedEnv: Record<string, string> = {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
        ),
        ...config.env,
      };

      // Create MCP client with stdio transport
      const client = await experimental_createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: config.command,
          args: config.args,
          cwd: config.cwd,
          env: mergedEnv,
        }),
      });

      managed.client = client;

      // Get tools from the server
      const tools = await client.tools();
      managed.tools = tools;

      // Convert tools to ToolInfo format
      const toolInfos: Record<string, ToolInfo> = {};
      for (const [name, tool] of Object.entries(tools)) {
        toolInfos[name] = {
          name,
          description: tool.description,
          inputSchema: tool.parameters,
        };
      }

      session.tools = toolInfos;
      session.status = 'running';
      session.lastActivity = new Date();

      console.log(`[ProcessManager] ${serverName} started with ${Object.keys(tools).length} tools`);

      return session;
    } catch (error) {
      console.error(`[ProcessManager] Failed to spawn ${serverName}:`, error);
      session.status = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      return session;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): MCPSession | null {
    const managed = this.processes.get(sessionId);
    if (managed) {
      managed.session.lastActivity = new Date();
      return managed.session;
    }
    return null;
  }

  /**
   * Get session by server name
   */
  getSessionByServerName(serverName: string): MCPSession | null {
    const sessionId = this.serverNameToSessionId.get(serverName);
    if (sessionId) {
      return this.getSession(sessionId);
    }
    return null;
  }

  /**
   * Get tools for a session
   */
  getTools(sessionId: string): ToolSet | null {
    const managed = this.processes.get(sessionId);
    if (managed && managed.session.status === 'running') {
      managed.session.lastActivity = new Date();
      return managed.tools;
    }
    return null;
  }

  /**
   * Execute a tool on a session
   */
  async execute(sessionId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const managed = this.processes.get(sessionId);
    if (!managed) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (managed.session.status !== 'running') {
      throw new Error(`Session not running: ${managed.session.status}`);
    }

    const tool = managed.tools[toolName];
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool ${toolName} does not have an execute function`);
    }

    managed.session.lastActivity = new Date();

    console.log(`[ProcessManager] Executing ${toolName} on ${managed.session.serverName}`);

    try {
      const result = await tool.execute(args, {
        messages: [],
        toolCallId: uuidv4(),
      });
      return result;
    } catch (error) {
      console.error(`[ProcessManager] Error executing ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Close a session and its process
   */
  async close(sessionId: string): Promise<void> {
    const managed = this.processes.get(sessionId);
    if (!managed) {
      return;
    }

    console.log(`[ProcessManager] Closing session ${sessionId} (${managed.session.serverName})`);

    try {
      if (managed.client) {
        await managed.client.close();
      }
    } catch (error) {
      console.error(`[ProcessManager] Error closing client:`, error);
    }

    this.processes.delete(sessionId);
    this.serverNameToSessionId.delete(managed.session.serverName);
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const sessionIds = Array.from(this.processes.keys());
    await Promise.all(sessionIds.map(id => this.close(id)));
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    let count = 0;
    for (const managed of this.processes.values()) {
      if (managed.session.status === 'running') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): MCPSession[] {
    return Array.from(this.processes.values()).map(m => m.session);
  }

  /**
   * Clean up inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [sessionId, managed] of this.processes.entries()) {
      const inactiveTime = now - managed.session.lastActivity.getTime();
      if (inactiveTime > this.sessionTimeout) {
        console.log(`[ProcessManager] Session ${sessionId} inactive for ${Math.round(inactiveTime / 1000)}s, closing`);
        toClose.push(sessionId);
      }
    }

    await Promise.all(toClose.map(id => this.close(id)));
  }
}

// Singleton instance
export const processManager = new ProcessManager();
