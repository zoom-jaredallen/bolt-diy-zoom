/**
 * useTemplateHook
 *
 * React hook for executing template post-creation hooks.
 * Used to automatically trigger actions (like Zoom App creation)
 * when a template is imported.
 */

import { useState, useCallback } from 'react';
import type { WebContainer } from '@webcontainer/api';
import {
  executeTemplateHook,
  detectTemplateFromUrl,
  extractProjectName,
  checkZoomAppApiStatus,
  type TemplateHookResult,
} from '~/lib/services/template-hooks';

/**
 * Hook state
 */
export interface UseTemplateHookState {
  isExecuting: boolean;
  progress: string | null;
  result: TemplateHookResult | null;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseTemplateHookReturn extends UseTemplateHookState {
  executeHook: (options: {
    gitUrl: string;
    webcontainer?: WebContainer;
    customProjectName?: string;
  }) => Promise<TemplateHookResult | null>;
  checkApiStatus: () => Promise<{ configured: boolean; credentials: Record<string, string> }>;
  reset: () => void;
}

/**
 * Hook for managing template post-creation hooks
 */
export function useTemplateHook(): UseTemplateHookReturn {
  const [state, setState] = useState<UseTemplateHookState>({
    isExecuting: false,
    progress: null,
    result: null,
    error: null,
  });

  /**
   * Update progress message
   */
  const handleProgress = useCallback((message: string) => {
    setState((prev) => ({ ...prev, progress: message }));
  }, []);

  /**
   * Execute template hook based on git URL
   */
  const executeHook = useCallback(
    async (options: {
      gitUrl: string;
      webcontainer?: WebContainer;
      customProjectName?: string;
    }): Promise<TemplateHookResult | null> => {
      const { gitUrl, webcontainer, customProjectName } = options;

      // Detect template from URL
      const template = detectTemplateFromUrl(gitUrl);

      if (!template) {
        console.log('[useTemplateHook] No matching template found for URL:', gitUrl);

        return null;
      }

      // Check if template has a hook
      if (!template.postCreateHook) {
        console.log('[useTemplateHook] Template has no post-create hook:', template.name);

        return null;
      }

      // Extract project name
      const projectName = customProjectName || extractProjectName(gitUrl);

      console.log('[useTemplateHook] Executing hook for template:', template.name, 'project:', projectName);

      // Set executing state
      setState({
        isExecuting: true,
        progress: 'Initializing...',
        result: null,
        error: null,
      });

      try {
        const result = await executeTemplateHook({
          template,
          projectName,
          webcontainer,
          onProgress: handleProgress,
        });

        setState((prev) => ({
          ...prev,
          isExecuting: false,
          progress: null,
          result,
          error: result && !result.success ? result.message : null,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        setState((prev) => ({
          ...prev,
          isExecuting: false,
          progress: null,
          result: null,
          error: errorMessage,
        }));

        return null;
      }
    },
    [handleProgress],
  );

  /**
   * Check if the Zoom App API is configured
   */
  const checkApiStatus = useCallback(async () => {
    return checkZoomAppApiStatus();
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      progress: null,
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    executeHook,
    checkApiStatus,
    reset,
  };
}
