/**
 * Data loader for Zoom API indexes
 * Loads pre-processed JSON data from disk
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryInfo, EndpointSummary, EndpointDetails } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory path
const DATA_DIR = __dirname;
const ENDPOINTS_DIR = join(DATA_DIR, 'endpoints');

// Cached data
let categoriesCache: CategoryInfo[] | null = null;
let endpointsIndexCache: EndpointSummary[] | null = null;
let scopesMapCache: Record<string, string[]> | null = null;

/**
 * Load categories index
 */
export function loadCategories(): CategoryInfo[] {
  if (categoriesCache) {
    return categoriesCache;
  }

  const filePath = join(DATA_DIR, 'categories.json');

  if (!existsSync(filePath)) {
    console.warn(`Categories file not found: ${filePath}`);

    return getPlaceholderCategories();
  }

  try {
    categoriesCache = JSON.parse(readFileSync(filePath, 'utf-8'));

    return categoriesCache!;
  } catch (error) {
    console.error('Failed to load categories:', error);

    return getPlaceholderCategories();
  }
}

/**
 * Load endpoints index (summaries only)
 */
export function loadEndpointsIndex(): EndpointSummary[] {
  if (endpointsIndexCache) {
    return endpointsIndexCache;
  }

  const filePath = join(DATA_DIR, 'endpoints-index.json');

  if (!existsSync(filePath)) {
    console.warn(`Endpoints index file not found: ${filePath}`);

    return getPlaceholderEndpoints();
  }

  try {
    endpointsIndexCache = JSON.parse(readFileSync(filePath, 'utf-8'));

    return endpointsIndexCache!;
  } catch (error) {
    console.error('Failed to load endpoints index:', error);

    return getPlaceholderEndpoints();
  }
}

/**
 * Load scopes map
 */
export function loadScopesMap(): Record<string, string[]> {
  if (scopesMapCache) {
    return scopesMapCache;
  }

  const filePath = join(DATA_DIR, 'scopes-map.json');

  if (!existsSync(filePath)) {
    console.warn(`Scopes map file not found: ${filePath}`);

    return {};
  }

  try {
    scopesMapCache = JSON.parse(readFileSync(filePath, 'utf-8'));

    return scopesMapCache!;
  } catch (error) {
    console.error('Failed to load scopes map:', error);

    return {};
  }
}

/**
 * Load endpoint details by ID
 */
export function loadEndpointDetails(endpointId: string): EndpointDetails | null {
  const filePath = join(ENDPOINTS_DIR, `${endpointId}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`Failed to load endpoint ${endpointId}:`, error);

    return null;
  }
}

/**
 * Search endpoints by query
 */
export function searchEndpoints(query: string, limit = 10): EndpointSummary[] {
  const endpoints = loadEndpointsIndex();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);

  // Score each endpoint based on match quality
  const scored = endpoints.map((endpoint) => {
    let score = 0;
    const searchableText = [
      endpoint.summary,
      endpoint.description || '',
      endpoint.path,
      ...(endpoint.tags || []),
    ]
      .join(' ')
      .toLowerCase();

    for (const term of queryTerms) {
      // Exact match in summary gets highest score
      if (endpoint.summary.toLowerCase().includes(term)) {
        score += 10;
      }

      // Match in path
      if (endpoint.path.toLowerCase().includes(term)) {
        score += 5;
      }

      // Match in description
      if (endpoint.description?.toLowerCase().includes(term)) {
        score += 3;
      }

      // Match in tags
      if (endpoint.tags?.some((tag) => tag.toLowerCase().includes(term))) {
        score += 2;
      }

      // Any match in searchable text
      if (searchableText.includes(term)) {
        score += 1;
      }
    }

    return { endpoint, score };
  });

  // Filter and sort by score
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.endpoint);
}

/**
 * Get endpoints by category
 */
export function getEndpointsByCategory(categoryId: string): EndpointSummary[] {
  const endpoints = loadEndpointsIndex();

  return endpoints.filter((ep) => ep.category === categoryId);
}

/**
 * Get scopes for multiple endpoints
 */
export function getScopesForEndpoints(endpointIds: string[]): Record<string, string[]> {
  const scopesMap = loadScopesMap();
  const result: Record<string, string[]> = {};

  for (const id of endpointIds) {
    if (scopesMap[id]) {
      result[id] = scopesMap[id];
    }
  }

  return result;
}

/**
 * Get all unique scopes used by the API
 */
export function getAllScopes(): string[] {
  const scopesMap = loadScopesMap();
  const allScopes = new Set<string>();

  for (const scopes of Object.values(scopesMap)) {
    for (const scope of scopes) {
      allScopes.add(scope);
    }
  }

  return [...allScopes].sort();
}

// Placeholder data for when files haven't been generated yet
function getPlaceholderCategories(): CategoryInfo[] {
  return [
    {
      id: 'meetings',
      name: 'Meetings',
      description: 'Zoom Meetings API - Create, manage, and control meetings',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'users',
      name: 'Users',
      description: 'Zoom Users API - User management and settings',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'phone',
      name: 'Phone',
      description: 'Zoom Phone API - Phone system management',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'contact-center',
      name: 'Contact Center',
      description: 'Zoom Contact Center API - Contact center management',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'number-management',
      name: 'Number Management',
      description: 'Zoom Number Management API - Phone number management',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'accounts',
      name: 'Accounts',
      description: 'Zoom Accounts API - Account management',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
    {
      id: 'marketplace',
      name: 'Marketplace',
      description: 'Zoom Marketplace API - App management and publishing',
      endpointCount: 0,
      methods: { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
    },
  ];
}

function getPlaceholderEndpoints(): EndpointSummary[] {
  return [
    {
      id: 'meetings-post-users-_param_-meetings',
      category: 'meetings',
      method: 'POST',
      path: '/users/{userId}/meetings',
      summary: 'Create a meeting',
      description: 'Create a meeting for a user. Run "npm run prepare-data" to load actual endpoints.',
      scopes: ['meeting:write:meeting'],
    },
    {
      id: 'meetings-get-meetings-_param_',
      category: 'meetings',
      method: 'GET',
      path: '/meetings/{meetingId}',
      summary: 'Get meeting details',
      description: 'Get details of a meeting. Run "npm run prepare-data" to load actual endpoints.',
      scopes: ['meeting:read:meeting'],
    },
    {
      id: 'users-get-users',
      category: 'users',
      method: 'GET',
      path: '/users',
      summary: 'List users',
      description: 'List users in an account. Run "npm run prepare-data" to load actual endpoints.',
      scopes: ['user:read:list_users'],
    },
  ];
}

/**
 * Clear all caches (useful for testing or hot-reloading)
 */
export function clearCaches(): void {
  categoriesCache = null;
  endpointsIndexCache = null;
  scopesMapCache = null;
}
