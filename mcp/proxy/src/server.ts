import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { processManager } from './processManager.js';
import {
  spawnRequestSchema,
  executeRequestSchema,
  type SpawnResponse,
  type ToolsResponse,
  type ExecuteResponse,
  type CloseResponse,
  type HealthResponse,
  type ErrorResponse,
  type ToolInfo,
} from './types.js';

const app = express();
const startTime = Date.now();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[MCP Proxy] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  res.json({
    status: 'ok',
    activeSessions: processManager.getActiveSessionCount(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * List all active sessions
 */
app.get('/api/sessions', (_req: Request, res: Response) => {
  const sessions = processManager.getAllSessions();
  res.json({ sessions });
});

/**
 * Spawn a new stdio MCP server
 * POST /api/spawn
 * Body: { serverName: string, config: StdioConfig }
 */
app.post('/api/spawn', async (req: Request, res: Response<SpawnResponse | ErrorResponse>) => {
  try {
    const parsed = spawnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.message,
      });
      return;
    }

    const { serverName, config } = parsed.data;
    const session = await processManager.spawn(serverName, config);

    res.json({
      sessionId: session.sessionId,
      serverName: session.serverName,
      status: session.status,
      error: session.error,
    });
  } catch (error) {
    console.error('[MCP Proxy] Spawn error:', error);
    res.status(500).json({
      error: 'Failed to spawn server',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get tools for a session
 * GET /api/tools/:sessionId
 */
app.get('/api/tools/:sessionId', (req: Request, res: Response<ToolsResponse | ErrorResponse>) => {
  try {
    const { sessionId } = req.params;
    const session = processManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const tools = processManager.getTools(sessionId);
    const toolInfos: Record<string, ToolInfo> = {};

    if (tools) {
      for (const [name, tool] of Object.entries(tools)) {
        toolInfos[name] = {
          name,
          description: tool.description,
          inputSchema: tool.parameters,
        };
      }
    }

    res.json({
      sessionId: session.sessionId,
      serverName: session.serverName,
      status: session.status,
      tools: toolInfos,
      error: session.error,
    });
  } catch (error) {
    console.error('[MCP Proxy] Get tools error:', error);
    res.status(500).json({
      error: 'Failed to get tools',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get tools by server name
 * GET /api/tools/server/:serverName
 */
app.get('/api/tools/server/:serverName', (req: Request, res: Response<ToolsResponse | ErrorResponse>) => {
  try {
    const { serverName } = req.params;
    const session = processManager.getSessionByServerName(serverName);

    if (!session) {
      res.status(404).json({ error: 'Server not found or not running' });
      return;
    }

    const tools = processManager.getTools(session.sessionId);
    const toolInfos: Record<string, ToolInfo> = {};

    if (tools) {
      for (const [name, tool] of Object.entries(tools)) {
        toolInfos[name] = {
          name,
          description: tool.description,
          inputSchema: tool.parameters,
        };
      }
    }

    res.json({
      sessionId: session.sessionId,
      serverName: session.serverName,
      status: session.status,
      tools: toolInfos,
      error: session.error,
    });
  } catch (error) {
    console.error('[MCP Proxy] Get tools by server error:', error);
    res.status(500).json({
      error: 'Failed to get tools',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Execute a tool
 * POST /api/execute/:sessionId
 * Body: { toolName: string, args: Record<string, unknown> }
 */
app.post('/api/execute/:sessionId', async (req: Request, res: Response<ExecuteResponse | ErrorResponse>) => {
  try {
    const { sessionId } = req.params;
    const parsed = executeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.message,
      });
      return;
    }

    const { toolName, args } = parsed.data;
    const result = await processManager.execute(sessionId, toolName, args);

    res.json({
      sessionId,
      toolName,
      result,
    });
  } catch (error) {
    console.error('[MCP Proxy] Execute error:', error);
    res.status(500).json({
      error: 'Failed to execute tool',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Execute a tool by server name
 * POST /api/execute/server/:serverName
 * Body: { toolName: string, args: Record<string, unknown> }
 */
app.post('/api/execute/server/:serverName', async (req: Request, res: Response<ExecuteResponse | ErrorResponse>) => {
  try {
    const { serverName } = req.params;
    const session = processManager.getSessionByServerName(serverName);

    if (!session) {
      res.status(404).json({ error: 'Server not found or not running' });
      return;
    }

    const parsed = executeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.message,
      });
      return;
    }

    const { toolName, args } = parsed.data;
    const result = await processManager.execute(session.sessionId, toolName, args);

    res.json({
      sessionId: session.sessionId,
      toolName,
      result,
    });
  } catch (error) {
    console.error('[MCP Proxy] Execute by server error:', error);
    res.status(500).json({
      error: 'Failed to execute tool',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Close a session
 * DELETE /api/close/:sessionId
 */
app.delete('/api/close/:sessionId', async (req: Request, res: Response<CloseResponse | ErrorResponse>) => {
  try {
    const { sessionId } = req.params;
    await processManager.close(sessionId);

    res.json({
      sessionId,
      status: 'closed',
    });
  } catch (error) {
    console.error('[MCP Proxy] Close error:', error);
    res.status(500).json({
      error: 'Failed to close session',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Close session by server name
 * DELETE /api/close/server/:serverName
 */
app.delete('/api/close/server/:serverName', async (req: Request, res: Response<CloseResponse | ErrorResponse>) => {
  try {
    const { serverName } = req.params;
    const session = processManager.getSessionByServerName(serverName);

    if (!session) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await processManager.close(session.sessionId);

    res.json({
      sessionId: session.sessionId,
      status: 'closed',
    });
  } catch (error) {
    console.error('[MCP Proxy] Close by server error:', error);
    res.status(500).json({
      error: 'Failed to close session',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
  console.error('[MCP Proxy] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

export { app };
