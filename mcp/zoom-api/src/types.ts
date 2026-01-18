/**
 * Type definitions for the Zoom API MCP Server
 */

export interface EndpointSummary {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  scopes?: string[];
}

export interface EndpointDetails {
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

export interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description?: string;
  enum?: string[];
}

export interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: SchemaInfo;
}

export interface ResponseInfo {
  description: string;
  schema?: SchemaInfo;
}

export interface SchemaInfo {
  type: string;
  properties?: Record<string, PropertyInfo>;
  required?: string[];
  items?: SchemaInfo;
}

export interface PropertyInfo {
  type: string;
  description?: string;
  enum?: string[];
  required?: boolean;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  endpointCount: number;
  methods: {
    GET: number;
    POST: number;
    PUT: number;
    PATCH: number;
    DELETE: number;
  };
}

export interface SearchResult {
  endpoint: EndpointSummary;
  score: number;
  matchedFields: string[];
}
