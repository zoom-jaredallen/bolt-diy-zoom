import { z } from 'zod';

/**
 * Stdio server configuration schema
 */
export const stdioConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export type StdioConfig = z.infer<typeof stdioConfigSchema>;

/**
 * Spawn request schema
 */
export const spawnRequestSchema = z.object({
  serverName: z.string().min(1),
  config: stdioConfigSchema,
});

export type SpawnRequest = z.infer<typeof spawnRequestSchema>;

/**
 * Execute request schema
 */
export const executeRequestSchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.unknown()).optional().default({}),
});

export type ExecuteRequest = z.infer<typeof executeRequestSchema>;

/**
 * Session status
 */
export type SessionStatus = 'starting' | 'running' | 'error' | 'closed';

/**
 * MCP Session info
 */
export interface MCPSession {
  sessionId: string;
  serverName: string;
  status: SessionStatus;
  error?: string;
  tools?: Record<string, ToolInfo>;
  startedAt: Date;
  lastActivity: Date;
}

/**
 * Tool information
 */
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * API response types
 */
export interface SpawnResponse {
  sessionId: string;
  serverName: string;
  status: SessionStatus;
  error?: string;
}

export interface ToolsResponse {
  sessionId: string;
  serverName: string;
  status: SessionStatus;
  tools: Record<string, ToolInfo>;
  error?: string;
}

export interface ExecuteResponse {
  sessionId: string;
  toolName: string;
  result?: unknown;
  error?: string;
}

export interface CloseResponse {
  sessionId: string;
  status: 'closed';
}

export interface HealthResponse {
  status: 'ok';
  activeSessions: number;
  uptime: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
