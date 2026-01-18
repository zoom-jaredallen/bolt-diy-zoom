/**
 * Zoom API MCP Adapter
 * Exposes zoom-api tools via MCP streamable-http protocol
 */

import { type Request, type Response, Router } from 'express';

// MCP Protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Import zoom-api data loading functions directly
let zoomApiLoader: {
  loadCategories: () => any[];
  loadEndpointsIndex: () => any[];
  loadEndpointDetails: (id: string) => any;
  searchEndpoints: (query: string, limit?: number) => any[];
  getEndpointsByCategory: (category: string) => any[];
  getScopesForEndpoints: (ids: string[]) => Record<string, string[]>;
  getAllScopes: () => string[];
} | null = null;

/**
 * Initialize the zoom-api adapter by loading the data module
 */
export async function initializeZoomApiAdapter(): Promise<boolean> {
  try {
    // Dynamic import of zoom-api data loader
    const loaderPath = '../../zoom-api/dist/data/loader.js';
    const loader = await import(loaderPath).catch(() => null);

    if (loader) {
      zoomApiLoader = {
        loadCategories: loader.loadCategories,
        loadEndpointsIndex: loader.loadEndpointsIndex,
        loadEndpointDetails: loader.loadEndpointDetails,
        searchEndpoints: loader.searchEndpoints,
        getEndpointsByCategory: loader.getEndpointsByCategory,
        getScopesForEndpoints: loader.getScopesForEndpoints,
        getAllScopes: loader.getAllScopes,
      };
      console.log('[ZoomApiAdapter] Initialized successfully');
      return true;
    }

    console.log('[ZoomApiAdapter] zoom-api data loader not available');
    return false;
  } catch (error) {
    console.error('[ZoomApiAdapter] Failed to initialize:', error);
    return false;
  }
}

/**
 * Check if zoom-api adapter is available
 */
export function isZoomApiAvailable(): boolean {
  return zoomApiLoader !== null;
}

/**
 * Get MCP tool definitions for zoom-api tools
 */
function getMCPToolDefinitions(): MCPToolDefinition[] {
  return [
    {
      name: 'zoom_list_categories',
      description: 'List all Zoom API categories with endpoint counts. Returns categories with their names and how many endpoints each contains.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'zoom_list_endpoints',
      description: 'List all endpoints in a specific Zoom API category. Returns endpoint IDs, methods, paths, and summaries.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'The category name (e.g., "Meetings", "Users", "Webinars")',
          },
        },
        required: ['category'],
      },
    },
    {
      name: 'zoom_get_endpoint',
      description: 'Get full details of a specific Zoom API endpoint including parameters, request/response schemas, and required scopes.',
      inputSchema: {
        type: 'object',
        properties: {
          endpointId: {
            type: 'string',
            description: 'The endpoint ID (e.g., "create-meeting")',
          },
          method: {
            type: 'string',
            description: 'HTTP method (alternative to endpointId)',
          },
          path: {
            type: 'string',
            description: 'API path (alternative to endpointId)',
          },
        },
      },
    },
    {
      name: 'zoom_search_endpoints',
      description: 'Search Zoom API endpoints by keyword. Searches endpoint names, descriptions, and paths.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "create meeting", "user", "recording")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'zoom_get_scopes',
      description: 'Get OAuth scopes required for Zoom API endpoints.',
      inputSchema: {
        type: 'object',
        properties: {
          endpointIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of endpoint IDs to get scopes for',
          },
          listAll: {
            type: 'boolean',
            description: 'Set to true to list all available scopes',
          },
        },
      },
    },
  ];
}

/**
 * Execute a zoom-api tool and return the result
 */
function executeZoomApiTool(toolName: string, args: Record<string, unknown>): unknown {
  if (!zoomApiLoader) {
    throw new Error('Zoom API adapter not initialized');
  }

  switch (toolName) {
    case 'zoom_list_categories': {
      const categories = zoomApiLoader.loadCategories();

      return {
        categories,
        totalCategories: categories.length,
        totalEndpoints: categories.reduce((sum: number, c: any) => sum + (c.endpointCount || 0), 0),
      };
    }

    case 'zoom_list_endpoints': {
      const { category } = args as { category: string };

      if (!category) {
        throw new Error('category is required');
      }

      const endpoints = zoomApiLoader.getEndpointsByCategory(category);

      return {
        category,
        endpointCount: endpoints.length,
        endpoints: endpoints.map((ep: any) => ({
          id: ep.id,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
        })),
      };
    }

    case 'zoom_get_endpoint': {
      const { endpointId, method, path } = args as { endpointId?: string; method?: string; path?: string };
      let id = endpointId;

      if (!id && method && path) {
        const allEndpoints = zoomApiLoader.loadEndpointsIndex();
        const found = allEndpoints.find(
          (ep: any) => ep.method.toUpperCase() === method.toUpperCase() && ep.path === path,
        );

        if (found) {
          id = found.id;
        }
      }

      if (!id) {
        return { error: 'Endpoint not found. Provide endpointId or both method and path.' };
      }

      const details = zoomApiLoader.loadEndpointDetails(id);

      return details || { error: `Endpoint "${id}" not found` };
    }

    case 'zoom_search_endpoints': {
      const { query, limit = 10 } = args as { query: string; limit?: number };

      if (!query) {
        throw new Error('query is required');
      }

      const results = zoomApiLoader.searchEndpoints(query, limit);

      return {
        query,
        resultCount: results.length,
        results: results.map((ep: any) => ({
          id: ep.id,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          category: ep.category,
          scopes: ep.scopes,
        })),
      };
    }

    case 'zoom_get_scopes': {
      const { endpointIds, listAll } = args as { endpointIds?: string[]; listAll?: boolean };

      if (listAll) {
        const allScopes = zoomApiLoader.getAllScopes();

        return { totalScopes: allScopes.length, scopes: allScopes };
      } else if (endpointIds && endpointIds.length > 0) {
        const scopesMap = zoomApiLoader.getScopesForEndpoints(endpointIds);
        const uniqueScopes = [...new Set(Object.values(scopesMap).flat())];

        return {
          endpointScopes: scopesMap,
          uniqueScopes,
          uniqueScopeCount: uniqueScopes.length,
        };
      } else {
        return { error: 'Provide endpointIds array or set listAll to true' };
      }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Create Express router for zoom-api endpoints
 * Implements MCP streamable-http protocol
 */
export function createZoomApiRouter(): Router {
  const router = Router();

  /*
   * MCP streamable-http protocol handler
   * Handles JSON-RPC style MCP messages at the root path
   */
  router.post('/', async (req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: { code: -32603, message: 'Zoom API adapter not initialized' },
      });

      return;
    }

    const mcpRequest = req.body as MCPRequest;

    if (!mcpRequest.method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: mcpRequest.id || null,
        error: { code: -32600, message: 'Invalid request: method is required' },
      });

      return;
    }

    console.log(`[ZoomApiAdapter] MCP request: ${mcpRequest.method}`);

    try {
      let result: unknown;

      switch (mcpRequest.method) {
        case 'initialize':
          // MCP initialization handshake
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'zoom-api',
              version: '1.0.0',
            },
          };
          break;

        case 'tools/list':
          // Return available tools
          result = {
            tools: getMCPToolDefinitions(),
          };
          break;

        case 'tools/call': {
          // Execute a tool
          const params = mcpRequest.params as { name: string; arguments?: Record<string, unknown> };

          if (!params?.name) {
            res.status(400).json({
              jsonrpc: '2.0',
              id: mcpRequest.id,
              error: { code: -32602, message: 'Invalid params: tool name is required' },
            });

            return;
          }

          const toolResult = executeZoomApiTool(params.name, params.arguments || {});
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
          };
          break;
        }

        case 'notifications/initialized':
          // Client acknowledges initialization - no response needed
          res.status(204).send();

          return;

        default:
          res.status(400).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: { code: -32601, message: `Method not found: ${mcpRequest.method}` },
          });

          return;
      }

      res.json({
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result,
      } as MCPResponse);
    } catch (error) {
      console.error('[ZoomApiAdapter] MCP error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      } as MCPResponse);
    }
  });

  // Legacy REST endpoints below (kept for backward compatibility)

  // List available tools (for MCP tool discovery)
  router.get('/tools', (_req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }

    res.json({
      tools: [
        {
          name: 'zoom_list_categories',
          description: 'List all Zoom API categories with endpoint counts',
        },
        {
          name: 'zoom_list_endpoints',
          description: 'List endpoints in a specific category',
        },
        {
          name: 'zoom_get_endpoint',
          description: 'Get full details of a specific endpoint',
        },
        {
          name: 'zoom_search_endpoints',
          description: 'Search endpoints by keyword',
        },
        {
          name: 'zoom_get_scopes',
          description: 'Get OAuth scopes for endpoints',
        },
      ],
    });
  });

  // Execute a tool
  router.post('/execute', async (req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }

    const { toolName, args = {} } = req.body;

    if (!toolName) {
      res.status(400).json({ error: 'toolName is required' });
      return;
    }

    try {
      let result: unknown;

      switch (toolName) {
        case 'zoom_list_categories': {
          const categories = zoomApiLoader.loadCategories();
          result = {
            categories,
            totalCategories: categories.length,
            totalEndpoints: categories.reduce((sum: number, c: any) => sum + (c.endpointCount || 0), 0),
          };
          break;
        }

        case 'zoom_list_endpoints': {
          const { category } = args as { category: string };
          if (!category) {
            res.status(400).json({ error: 'category is required' });
            return;
          }
          const endpoints = zoomApiLoader.getEndpointsByCategory(category);
          result = {
            category,
            endpointCount: endpoints.length,
            endpoints: endpoints.map((ep: any) => ({
              id: ep.id,
              method: ep.method,
              path: ep.path,
              summary: ep.summary,
            })),
          };
          break;
        }

        case 'zoom_get_endpoint': {
          const { endpointId, method, path } = args as { endpointId?: string; method?: string; path?: string };
          let id = endpointId;

          if (!id && method && path) {
            const allEndpoints = zoomApiLoader.loadEndpointsIndex();
            const found = allEndpoints.find(
              (ep: any) => ep.method.toUpperCase() === method.toUpperCase() && ep.path === path,
            );
            if (found) id = found.id;
          }

          if (!id) {
            result = { error: 'Endpoint not found' };
          } else {
            const details = zoomApiLoader.loadEndpointDetails(id);
            result = details || { error: `Endpoint "${id}" not found` };
          }
          break;
        }

        case 'zoom_search_endpoints': {
          const { query, limit = 10 } = args as { query: string; limit?: number };
          if (!query) {
            res.status(400).json({ error: 'query is required' });
            return;
          }
          const results = zoomApiLoader.searchEndpoints(query, limit);
          result = {
            query,
            resultCount: results.length,
            results: results.map((ep: any) => ({
              id: ep.id,
              method: ep.method,
              path: ep.path,
              summary: ep.summary,
              category: ep.category,
              scopes: ep.scopes,
            })),
          };
          break;
        }

        case 'zoom_get_scopes': {
          const { endpointIds, listAll } = args as { endpointIds?: string[]; listAll?: boolean };

          if (listAll) {
            const allScopes = zoomApiLoader.getAllScopes();
            result = { totalScopes: allScopes.length, scopes: allScopes };
          } else if (endpointIds && endpointIds.length > 0) {
            const scopesMap = zoomApiLoader.getScopesForEndpoints(endpointIds);
            const uniqueScopes = [...new Set(Object.values(scopesMap).flat())];
            result = {
              endpointScopes: scopesMap,
              uniqueScopes,
              uniqueScopeCount: uniqueScopes.length,
            };
          } else {
            result = { error: 'Provide endpointIds array or set listAll to true' };
          }
          break;
        }

        default:
          res.status(400).json({ error: `Unknown tool: ${toolName}` });
          return;
      }

      res.json({ result });
    } catch (error) {
      console.error('[ZoomApiAdapter] Error executing tool:', error);
      res.status(500).json({
        error: 'Tool execution failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Convenience endpoints for direct access
  router.get('/categories', (_req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }
    res.json(zoomApiLoader.loadCategories());
  });

  router.get('/endpoints', (req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }
    const category = req.query.category as string | undefined;
    if (category) {
      res.json(zoomApiLoader.getEndpointsByCategory(category));
    } else {
      res.json(zoomApiLoader.loadEndpointsIndex());
    }
  });

  router.get('/endpoints/:endpointId', (req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }
    const details = zoomApiLoader.loadEndpointDetails(req.params.endpointId);
    if (details) {
      res.json(details);
    } else {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  });

  router.get('/search', (req: Request, res: Response) => {
    if (!zoomApiLoader) {
      res.status(503).json({ error: 'Zoom API adapter not initialized' });
      return;
    }
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;
    if (!query) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }
    res.json(zoomApiLoader.searchEndpoints(query, limit));
  });

  return router;
}
