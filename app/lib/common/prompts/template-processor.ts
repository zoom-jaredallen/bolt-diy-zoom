import type { DesignScheme } from '~/types/design-scheme';
import { WORK_DIR } from '~/utils/constants';
import { allowedHTMLElements } from '~/utils/markdown';

/**
 * Context object passed to template processor
 */
export interface TemplateContext {
  cwd: string;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
  designScheme?: DesignScheme;
}

/**
 * Available template variables and their descriptions
 */
export const TEMPLATE_VARIABLES: Record<string, { description: string; example: string }> = {
  '{{cwd}}': {
    description: 'Current working directory path',
    example: '/home/project',
  },
  '{{allowedHtmlElements}}': {
    description: 'List of allowed HTML elements for markdown formatting',
    example: '<strong>, <em>, <code>, ...',
  },
  '{{supabase.isConnected}}': {
    description: 'Whether Supabase is connected (true/false)',
    example: 'true',
  },
  '{{supabase.hasSelectedProject}}': {
    description: 'Whether a Supabase project is selected (true/false)',
    example: 'false',
  },
  '{{supabase.credentials.supabaseUrl}}': {
    description: 'Supabase project URL',
    example: 'https://xyz.supabase.co',
  },
  '{{supabase.credentials.anonKey}}': {
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  },
  '{{designScheme.font}}': {
    description: 'User-selected font scheme (JSON)',
    example: '{"family": "Inter", "size": "16px"}',
  },
  '{{designScheme.palette}}': {
    description: 'User-selected color palette (JSON)',
    example: '{"primary": "#3B82F6", "secondary": "#10B981"}',
  },
  '{{designScheme.features}}': {
    description: 'Design features configuration (JSON)',
    example: '{"darkMode": true, "roundedCorners": true}',
  },
};

/**
 * Conditional block patterns
 */
const CONDITIONAL_PATTERN = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/**
 * Simple variable pattern
 */
const VARIABLE_PATTERN = /\{\{([^#/][^}]*)\}\}/g;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(condition: string, context: Record<string, any>): boolean {
  const trimmed = condition.trim();

  // Handle negation
  if (trimmed.startsWith('!')) {
    return !evaluateCondition(trimmed.slice(1), context);
  }

  // Handle comparison operators
  if (trimmed.includes('===')) {
    const [left, right] = trimmed.split('===').map((s) => s.trim());
    const leftValue = getNestedValue(context, left);
    const rightValue = right.replace(/['"]/g, '');

    return String(leftValue) === rightValue;
  }

  if (trimmed.includes('!==')) {
    const [left, right] = trimmed.split('!==').map((s) => s.trim());
    const leftValue = getNestedValue(context, left);
    const rightValue = right.replace(/['"]/g, '');

    return String(leftValue) !== rightValue;
  }

  // Simple truthy check
  const value = getNestedValue(context, trimmed);

  return Boolean(value);
}

/**
 * Process conditional blocks in template
 */
function processConditionals(template: string, context: Record<string, any>): string {
  return template.replace(CONDITIONAL_PATTERN, (_, condition, ifContent, elseContent = '') => {
    const result = evaluateCondition(condition, context);

    return result ? ifContent : elseContent;
  });
}

/**
 * Process simple variable replacements
 */
function processVariables(template: string, context: Record<string, any>): string {
  return template.replace(VARIABLE_PATTERN, (match, path) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(context, trimmedPath);

    if (value === undefined) {
      // Return the original placeholder if variable not found
      return match;
    }

    // Convert objects to JSON string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Build the full context object from options
 */
export function buildTemplateContext(options: TemplateContext): Record<string, any> {
  return {
    cwd: options.cwd || WORK_DIR,
    allowedHtmlElements: allowedHTMLElements.map((tag) => `<${tag}>`).join(', '),
    supabase: {
      isConnected: options.supabase?.isConnected || false,
      hasSelectedProject: options.supabase?.hasSelectedProject || false,
      credentials: {
        supabaseUrl: options.supabase?.credentials?.supabaseUrl || '',
        anonKey: options.supabase?.credentials?.anonKey || '',
      },
    },
    designScheme: {
      font: options.designScheme?.font || null,
      palette: options.designScheme?.palette || null,
      features: options.designScheme?.features || null,
    },
  };
}

/**
 * Process a template string with the given context
 */
export function processTemplate(template: string, options: TemplateContext): string {
  const context = buildTemplateContext(options);

  // First process conditionals, then variables
  let result = processConditionals(template, context);
  result = processVariables(result, context);

  return result;
}

/**
 * Validate a template and return any errors
 */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for unmatched conditional blocks
  const ifCount = (template.match(/\{\{#if/g) || []).length;
  const endIfCount = (template.match(/\{\{\/if\}\}/g) || []).length;

  if (ifCount !== endIfCount) {
    errors.push(`Unmatched conditional blocks: ${ifCount} {{#if}} vs ${endIfCount} {{/if}}`);
  }

  // Check for unknown variables (warning only)
  const variableMatches = template.matchAll(/\{\{([^#/][^}]*)\}\}/g);
  const knownPaths = new Set([
    'cwd',
    'allowedHtmlElements',
    'supabase.isConnected',
    'supabase.hasSelectedProject',
    'supabase.credentials.supabaseUrl',
    'supabase.credentials.anonKey',
    'designScheme.font',
    'designScheme.palette',
    'designScheme.features',
  ]);

  for (const match of variableMatches) {
    const path = match[1].trim();

    if (!knownPaths.has(path)) {
      // Not an error, just a warning - custom variables are allowed
      console.warn(`Unknown template variable: {{${path}}}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract all variables used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();

  // Extract from conditionals
  const conditionalMatches = template.matchAll(/\{\{#if\s+([^}]+)\}\}/g);

  for (const match of conditionalMatches) {
    const condition = match[1].trim();

    // Extract variable from condition (handle negation and comparisons)
    const cleanCondition = condition.replace(/^!/, '').split(/[!=]+/)[0].trim();
    variables.add(cleanCondition);
  }

  // Extract regular variables
  const variableMatches = template.matchAll(/\{\{([^#/][^}]*)\}\}/g);

  for (const match of variableMatches) {
    variables.add(match[1].trim());
  }

  return Array.from(variables);
}

/**
 * Get a preview of template with sample values
 */
export function getTemplatePreview(template: string): string {
  const sampleContext: TemplateContext = {
    cwd: '/home/project',
    supabase: {
      isConnected: true,
      hasSelectedProject: true,
      credentials: {
        supabaseUrl: 'https://example.supabase.co',
        anonKey: 'sample-anon-key',
      },
    },
    designScheme: {
      font: ['sans-serif'],
      palette: {
        primary: '#9E7FFF',
        secondary: '#38bdf8',
        accent: '#f472b6',
        background: '#171717',
        surface: '#262626',
        text: '#FFFFFF',
        textSecondary: '#A3A3A3',
        border: '#2F2F2F',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      features: ['rounded'],
    },
  };

  return processTemplate(template, sampleContext);
}
