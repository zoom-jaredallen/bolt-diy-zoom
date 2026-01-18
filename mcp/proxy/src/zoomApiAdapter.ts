/**
 * Zoom API MCP Adapter
 * Exposes zoom-api tools directly via HTTP endpoints
 */

import { type Request, type Response, Router } from 'express';

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
 * Create Express router for zoom-api endpoints
 * Exposes MCP-style tool calls as REST endpoints
 */
export function createZoomApiRouter(): Router {
  const router = Router();

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
