/**
 * Zoom API MCP Server
 * Provides tools for discovering and understanding Zoom API endpoints
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  loadCategories,
  loadEndpointsIndex,
  loadEndpointDetails,
  searchEndpoints,
  getEndpointsByCategory,
  getScopesForEndpoints,
  getAllScopes,
} from './data/loader.js';

// Tool input schemas
const ListCategoriesSchema = z.object({});

const ListEndpointsSchema = z.object({
  category: z.string().describe('Category ID (e.g., "meetings", "users", "phone")'),
});

const GetEndpointSchema = z.object({
  endpointId: z.string().optional().describe('Endpoint ID (e.g., "meetings-post-users-_param_-meetings")'),
  method: z.string().optional().describe('HTTP method (GET, POST, PUT, PATCH, DELETE)'),
  path: z.string().optional().describe('API path (e.g., "/users/{userId}/meetings")'),
});

const SearchEndpointsSchema = z.object({
  query: z.string().describe('Search query (e.g., "create meeting", "list users", "phone")'),
  limit: z.number().optional().default(10).describe('Maximum results to return (default: 10)'),
});

const GetScopesSchema = z.object({
  endpointIds: z.array(z.string()).optional().describe('List of endpoint IDs to get scopes for'),
  listAll: z.boolean().optional().describe('If true, returns all available OAuth scopes'),
});

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'zoom-api',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'zoom_list_categories',
          description:
            'List all Zoom API categories (Meetings, Users, Phone, etc.) with endpoint counts and available HTTP methods.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
            required: [],
          },
        },
        {
          name: 'zoom_list_endpoints',
          description:
            'List all endpoints in a specific Zoom API category. Returns endpoint summaries with path, method, and description.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              category: {
                type: 'string',
                description: 'Category ID (e.g., "meetings", "users", "phone", "contact-center")',
              },
            },
            required: ['category'],
          },
        },
        {
          name: 'zoom_get_endpoint',
          description:
            'Get full details of a specific Zoom API endpoint including parameters, request body, response schema, and required OAuth scopes.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              endpointId: {
                type: 'string',
                description: 'Endpoint ID from list_endpoints or search_endpoints',
              },
              method: {
                type: 'string',
                description: 'HTTP method (GET, POST, PUT, PATCH, DELETE)',
              },
              path: {
                type: 'string',
                description: 'API path (e.g., "/users/{userId}/meetings")',
              },
            },
            required: [],
          },
        },
        {
          name: 'zoom_search_endpoints',
          description:
            'Search Zoom API endpoints by keyword. Useful for finding endpoints related to specific functionality.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "create meeting", "list users", "phone")',
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return (default: 10)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'zoom_get_scopes',
          description:
            'Get OAuth scopes required for Zoom API endpoints. Can return scopes for specific endpoints or list all available scopes.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              endpointIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of endpoint IDs to get scopes for',
              },
              listAll: {
                type: 'boolean',
                description: 'If true, returns all available OAuth scopes',
              },
            },
            required: [],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'zoom_list_categories': {
          const categories = loadCategories();
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    categories,
                    totalCategories: categories.length,
                    totalEndpoints: categories.reduce((sum, c) => sum + c.endpointCount, 0),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case 'zoom_list_endpoints': {
          const input = ListEndpointsSchema.parse(args);
          const endpoints = getEndpointsByCategory(input.category);

          if (endpoints.length === 0) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: `No endpoints found for category "${input.category}"`,
                      availableCategories: loadCategories().map((c) => c.id),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    category: input.category,
                    endpointCount: endpoints.length,
                    endpoints: endpoints.map((ep) => ({
                      id: ep.id,
                      method: ep.method,
                      path: ep.path,
                      summary: ep.summary,
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case 'zoom_get_endpoint': {
          const input = GetEndpointSchema.parse(args);
          let endpointId = input.endpointId;

          // If method and path provided, find the endpoint ID
          if (!endpointId && input.method && input.path) {
            const allEndpoints = loadEndpointsIndex();
            const found = allEndpoints.find(
              (ep) => ep.method.toUpperCase() === input.method!.toUpperCase() && ep.path === input.path,
            );
            if (found) {
              endpointId = found.id;
            }
          }

          if (!endpointId) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: 'Endpoint not found. Provide either endpointId or both method and path.',
                      hint: 'Use zoom_search_endpoints to find endpoint IDs',
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          const details = loadEndpointDetails(endpointId);

          if (!details) {
            // Try to find in index for basic info
            const allEndpoints = loadEndpointsIndex();
            const summary = allEndpoints.find((ep) => ep.id === endpointId);

            if (summary) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      {
                        ...summary,
                        note: 'Full details not available. Run "npm run prepare-data" in the zoom-api directory.',
                      },
                      null,
                      2,
                    ),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: `Endpoint "${endpointId}" not found`,
                      hint: 'Use zoom_search_endpoints or zoom_list_endpoints to find valid endpoint IDs',
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(details, null, 2),
              },
            ],
          };
        }

        case 'zoom_search_endpoints': {
          const input = SearchEndpointsSchema.parse(args);
          const results = searchEndpoints(input.query, input.limit);

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    query: input.query,
                    resultCount: results.length,
                    results: results.map((ep) => ({
                      id: ep.id,
                      method: ep.method,
                      path: ep.path,
                      summary: ep.summary,
                      category: ep.category,
                      scopes: ep.scopes,
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case 'zoom_get_scopes': {
          const input = GetScopesSchema.parse(args);

          if (input.listAll) {
            const allScopes = getAllScopes();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      totalScopes: allScopes.length,
                      scopes: allScopes,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          if (input.endpointIds && input.endpointIds.length > 0) {
            const scopesMap = getScopesForEndpoints(input.endpointIds);
            const uniqueScopes = [...new Set(Object.values(scopesMap).flat())];

            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      endpointScopes: scopesMap,
                      uniqueScopes,
                      uniqueScopeCount: uniqueScopes.length,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'Provide endpointIds array or set listAll to true',
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: `Unknown tool: ${name}` }),
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Register resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'zoom://api/rate-limits',
          mimeType: 'application/json',
          name: 'Zoom API Rate Limits',
          description: 'Rate limit information for Zoom APIs',
        },
        {
          uri: 'zoom://sdk/capabilities',
          mimeType: 'application/json',
          name: 'Zoom Apps SDK Capabilities',
          description: 'Available capabilities in @zoom/appssdk',
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'zoom://api/rate-limits') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                description: 'Zoom API Rate Limits',
                defaultLimits: {
                  perSecond: 10,
                  perDay: 5000,
                },
                categoryLimits: {
                  meetings: { perSecond: 10, perDay: 5000 },
                  users: { perSecond: 10, perDay: 5000 },
                  phone: { perSecond: 10, perDay: 5000 },
                  reports: { perSecond: 1, perDay: 1000 },
                },
                notes: [
                  'Rate limits vary by endpoint and account type',
                  'Pro accounts have higher limits than Basic',
                  'Use Retry-After header for 429 responses',
                  'See https://developers.zoom.us/docs/api/rest/rate-limits/',
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === 'zoom://sdk/capabilities') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                description: 'Zoom Apps SDK (@zoom/appssdk) Capabilities',
                commonCapabilities: [
                  'getRunningContext',
                  'getSupportedJsApis',
                  'openUrl',
                  'getMeetingContext',
                  'getUserContext',
                  'getPhoneContext',
                  'sendAppInvitation',
                  'showNotification',
                  'cloudRecording',
                  'authorize',
                ],
                meetingCapabilities: [
                  'getMeetingParticipants',
                  'getMeetingUUID',
                  'getUserMediaAudio',
                  'getUserMediaVideo',
                  'setUserMediaAudio',
                  'setUserMediaVideo',
                  'allowParticipantToRecord',
                  'drawParticipant',
                  'clearParticipant',
                  'drawImage',
                  'clearImage',
                ],
                initialization: {
                  example: `import zoomSdk from '@zoom/appssdk';

await zoomSdk.config({
  capabilities: [
    'getRunningContext',
    'getMeetingContext',
    'getUserContext'
  ]
});`,
                },
                docs: 'https://developers.zoom.us/docs/zoom-apps/js-sdk/',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Resource not found: ${uri}`,
        },
      ],
    };
  });

  return server;
}

/**
 * Run the server with stdio transport (default)
 */
export async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Zoom API MCP Server running on stdio');
}
