#!/usr/bin/env tsx
/**
 * Build lightweight JSON indexes from raw API specs
 * Run with: npm run build-index
 * 
 * This processes the large OpenAPI specs into smaller, focused files
 * that can be efficiently loaded by the MCP server.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RAW_SPECS_DIR = join(__dirname, '..', 'data', 'raw-specs');
const OUTPUT_DIR = join(__dirname, '..', 'src', 'data');
const ENDPOINTS_DIR = join(OUTPUT_DIR, 'endpoints');

// Types for processed data
interface EndpointSummary {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  scopes?: string[];
}

interface EndpointDetails {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  scopes?: string[];
  parameters?: ParameterInfo[];
  requestBody?: RequestBodyInfo;
  responses?: Record<string, ResponseInfo>;
  deprecated?: boolean;
}

interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description?: string;
  enum?: string[];
}

interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: SchemaInfo;
}

interface ResponseInfo {
  description: string;
  schema?: SchemaInfo;
}

interface SchemaInfo {
  type: string;
  properties?: Record<string, PropertyInfo>;
  required?: string[];
  items?: SchemaInfo;
}

interface PropertyInfo {
  type: string;
  description?: string;
  enum?: string[];
  required?: boolean;
}

interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  endpointCount: number;
  methods: { GET: number; POST: number; PUT: number; PATCH: number; DELETE: number };
}

// Helper to generate endpoint ID
function generateEndpointId(category: string, method: string, path: string): string {
  const pathParts = path
    .replace(/\{[^}]+\}/g, '_param_')
    .split('/')
    .filter(Boolean)
    .join('-');
  return `${category}-${method.toLowerCase()}-${pathParts}`.replace(/[^a-z0-9-]/g, '-');
}

// Extract scopes from security requirements
function extractScopes(operation: any): string[] {
  const scopes: string[] = [];
  if (operation.security) {
    for (const secReq of operation.security) {
      for (const [, scopeList] of Object.entries(secReq)) {
        if (Array.isArray(scopeList)) {
          scopes.push(...(scopeList as string[]));
        }
      }
    }
  }
  return [...new Set(scopes)];
}

// Extract parameter info
function extractParameters(parameters: any[]): ParameterInfo[] {
  if (!parameters) return [];
  return parameters.map((p) => ({
    name: p.name,
    in: p.in,
    required: p.required || false,
    type: p.schema?.type || 'string',
    description: p.description,
    enum: p.schema?.enum,
  }));
}

// Simplify schema for output
function simplifySchema(schema: any, depth = 0): SchemaInfo | undefined {
  if (!schema || depth > 3) return undefined;

  const result: SchemaInfo = {
    type: schema.type || 'object',
  };

  if (schema.properties) {
    result.properties = {};
    for (const [name, prop] of Object.entries(schema.properties) as [string, any][]) {
      result.properties[name] = {
        type: prop.type || 'unknown',
        description: prop.description,
        enum: prop.enum,
      };
    }
    result.required = schema.required;
  }

  if (schema.items) {
    result.items = simplifySchema(schema.items, depth + 1);
  }

  return result;
}

// Extract request body info
function extractRequestBody(requestBody: any): RequestBodyInfo | undefined {
  if (!requestBody) return undefined;

  const content = requestBody.content;
  if (!content) return undefined;

  const contentType = Object.keys(content)[0];
  const mediaType = content[contentType];

  return {
    required: requestBody.required || false,
    contentType,
    schema: simplifySchema(mediaType?.schema) || { type: 'object' },
  };
}

// Extract response info
function extractResponses(responses: any): Record<string, ResponseInfo> | undefined {
  if (!responses) return undefined;

  const result: Record<string, ResponseInfo> = {};

  for (const [code, response] of Object.entries(responses) as [string, any][]) {
    const content = response.content;
    let schema: SchemaInfo | undefined;

    if (content) {
      const contentType = Object.keys(content)[0];
      schema = simplifySchema(content[contentType]?.schema);
    }

    result[code] = {
      description: response.description || '',
      schema,
    };
  }

  return result;
}

// Process a single spec file
function processSpec(category: string, specPath: string): { 
  summaries: EndpointSummary[]; 
  details: EndpointDetails[];
  categoryInfo: CategoryInfo;
} {
  console.log(`Processing ${category}...`);
  
  const rawSpec = JSON.parse(readFileSync(specPath, 'utf-8'));
  const summaries: EndpointSummary[] = [];
  const details: EndpointDetails[] = [];
  const methodCounts = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };

  // Handle different spec formats
  const paths = rawSpec.paths || rawSpec;
  
  for (const [path, pathItem] of Object.entries(paths) as [string, any][]) {
    if (!path.startsWith('/')) continue; // Skip non-path entries
    
    const methods = ['get', 'post', 'put', 'patch', 'delete'];
    
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const id = generateEndpointId(category, method, path);
      const scopes = extractScopes(operation);
      const upperMethod = method.toUpperCase() as keyof typeof methodCounts;
      methodCounts[upperMethod]++;

      // Create summary (lightweight)
      summaries.push({
        id,
        category,
        method: upperMethod,
        path,
        summary: operation.summary || operation.operationId || path,
        description: operation.description?.substring(0, 200),
        tags: operation.tags,
        scopes,
      });

      // Create detailed info
      details.push({
        id,
        category,
        method: upperMethod,
        path,
        summary: operation.summary || operation.operationId || path,
        description: operation.description,
        tags: operation.tags,
        scopes,
        parameters: extractParameters([...(pathItem.parameters || []), ...(operation.parameters || [])]),
        requestBody: extractRequestBody(operation.requestBody),
        responses: extractResponses(operation.responses),
        deprecated: operation.deprecated,
      });
    }
  }

  const categoryInfo: CategoryInfo = {
    id: category,
    name: category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: rawSpec.info?.description || `Zoom ${category} API endpoints`,
    endpointCount: summaries.length,
    methods: methodCounts,
  };

  console.log(`  ✓ Found ${summaries.length} endpoints`);
  
  return { summaries, details, categoryInfo };
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Zoom API Index Builder');
  console.log('='.repeat(60));
  console.log('');

  // Check for raw specs
  if (!existsSync(RAW_SPECS_DIR)) {
    console.error(`Error: Raw specs directory not found: ${RAW_SPECS_DIR}`);
    console.error('Run "npm run fetch-specs" first.');
    process.exit(1);
  }

  // Create output directories
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(ENDPOINTS_DIR, { recursive: true });

  const specFiles = readdirSync(RAW_SPECS_DIR).filter((f) => f.endsWith('.json'));
  
  if (specFiles.length === 0) {
    console.error('No spec files found. Run "npm run fetch-specs" first.');
    process.exit(1);
  }

  const allSummaries: EndpointSummary[] = [];
  const categories: CategoryInfo[] = [];
  const scopesMap: Record<string, string[]> = {};

  for (const specFile of specFiles) {
    const category = basename(specFile, '.json');
    const specPath = join(RAW_SPECS_DIR, specFile);
    
    try {
      const { summaries, details, categoryInfo } = processSpec(category, specPath);
      
      allSummaries.push(...summaries);
      categories.push(categoryInfo);

      // Write individual endpoint detail files
      for (const detail of details) {
        const detailPath = join(ENDPOINTS_DIR, `${detail.id}.json`);
        writeFileSync(detailPath, JSON.stringify(detail, null, 2));
        
        // Build scopes map
        if (detail.scopes && detail.scopes.length > 0) {
          scopesMap[detail.id] = detail.scopes;
        }
      }
    } catch (error) {
      console.error(`  ✗ Failed to process ${category}:`, error);
    }
  }

  // Write categories index
  const categoriesPath = join(OUTPUT_DIR, 'categories.json');
  writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
  console.log(`\n✓ Wrote categories index: ${categoriesPath}`);

  // Write endpoints index (summaries only)
  const endpointsIndexPath = join(OUTPUT_DIR, 'endpoints-index.json');
  writeFileSync(endpointsIndexPath, JSON.stringify(allSummaries, null, 2));
  console.log(`✓ Wrote endpoints index: ${endpointsIndexPath}`);

  // Write scopes map
  const scopesPath = join(OUTPUT_DIR, 'scopes-map.json');
  writeFileSync(scopesPath, JSON.stringify(scopesMap, null, 2));
  console.log(`✓ Wrote scopes map: ${scopesPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Categories processed: ${categories.length}`);
  console.log(`Total endpoints: ${allSummaries.length}`);
  console.log(`Endpoint detail files: ${allSummaries.length}`);
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
