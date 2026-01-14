/**
 * Template Hooks Service
 *
 * Handles post-creation hooks for starter templates.
 * Currently supports:
 * - zoom-app-create: Creates a Zoom App via Marketplace API
 */

import type { WebContainer } from '@webcontainer/api';
import type { Template } from '~/types/template';
import type { ZoomAppCreateResult, ZoomAppCreateError } from '~/types/zoom';
import { STARTER_TEMPLATES } from '~/utils/constants';

/**
 * Result of executing a template hook
 */
export interface TemplateHookResult {
  success: boolean;
  hookType: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Options for executing template hooks
 */
export interface ExecuteHookOptions {
  template: Template;
  projectName: string;
  webcontainer?: WebContainer;
  onProgress?: (message: string) => void;
}

/**
 * Detect which template was used based on the GitHub URL
 * URL format: https://github.com/{owner}/{repo}.git
 */
export function detectTemplateFromUrl(gitUrl: string): Template | null {
  // Extract owner/repo from URL
  const match = gitUrl.match(/github\.com\/([^/]+\/[^/.]+)/);

  if (!match) {
    return null;
  }

  const repoPath = match[1];

  // Find matching template
  return STARTER_TEMPLATES.find((t) => t.githubRepo === repoPath) || null;
}

/**
 * Extract project name from GitHub URL
 */
export function extractProjectName(gitUrl: string): string {
  // Extract repo name from URL
  const match = gitUrl.match(/\/([^/]+)\.git$/);

  if (match) {
    return match[1];
  }

  // Fallback: use timestamp
  return `zoom-app-${Date.now()}`;
}

/**
 * Execute post-create hook for a template
 */
export async function executeTemplateHook(options: ExecuteHookOptions): Promise<TemplateHookResult | null> {
  const { template, projectName, webcontainer, onProgress } = options;

  // Check if template has a post-create hook
  if (!template.postCreateHook) {
    return null;
  }

  const hook = template.postCreateHook;

  switch (hook.type) {
    case 'zoom-app-create':
      return executeZoomAppCreateHook({
        appName: projectName,
        webcontainer,
        onProgress,
        required: hook.required,
      });

    default:
      console.warn(`[TemplateHooks] Unknown hook type: ${hook.type}`);

      return null;
  }
}

/**
 * Execute Zoom App creation hook
 */
async function executeZoomAppCreateHook(options: {
  appName: string;
  webcontainer?: WebContainer;
  onProgress?: (message: string) => void;
  required?: boolean;
}): Promise<TemplateHookResult> {
  const { appName, webcontainer, onProgress, required = false } = options;

  onProgress?.('Creating Zoom App via Marketplace API...');

  try {
    // Call the Zoom App creation API
    const response = await fetch('/api/zoom-app-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appName,
      }),
    });

    const result = (await response.json()) as ZoomAppCreateResult | ZoomAppCreateError;

    if (!result.success) {
      const errorResult = result as ZoomAppCreateError;
      console.error('[TemplateHooks] Zoom App creation failed:', errorResult.error);

      if (required) {
        throw new Error(errorResult.error);
      }

      return {
        success: false,
        hookType: 'zoom-app-create',
        message: `Failed to create Zoom App: ${errorResult.error}`,
        data: { code: errorResult.code },
      };
    }

    const successResult = result as ZoomAppCreateResult;
    onProgress?.('Writing credentials to .env file...');

    // Write credentials to WebContainer .env file
    if (webcontainer && successResult.envContent) {
      try {
        await webcontainer.fs.writeFile('.env', successResult.envContent);
        console.log('[TemplateHooks] Credentials written to .env file');
      } catch (writeError) {
        console.error('[TemplateHooks] Failed to write .env file:', writeError);

        // Non-fatal: credentials are still available in the response
      }
    }

    onProgress?.('Zoom App created successfully!');

    return {
      success: true,
      hookType: 'zoom-app-create',
      message: `Zoom App "${successResult.appName}" created successfully!`,
      data: {
        appId: successResult.appId,
        appName: successResult.appName,
        credentials: successResult.credentials,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TemplateHooks] Zoom App hook error:', error);

    return {
      success: false,
      hookType: 'zoom-app-create',
      message: `Zoom App creation failed: ${message}`,
    };
  }
}

/**
 * Check if the Zoom App creation API is configured
 */
export async function checkZoomAppApiStatus(): Promise<{
  configured: boolean;
  credentials: Record<string, string>;
}> {
  try {
    const response = await fetch('/api/zoom-app-create');
    const status = (await response.json()) as { configured: boolean; credentials: Record<string, string> };

    return {
      configured: status.configured,
      credentials: status.credentials,
    };
  } catch {
    return {
      configured: false,
      credentials: {},
    };
  }
}
