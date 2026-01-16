import { useState, useEffect, useCallback } from 'react';
import { initZoomSdk, getMeetingContext, getUserContext, showNotification, type ZoomConfig } from '../lib/zoom';

interface ZoomState {
  isReady: boolean;
  isLoading: boolean;
  isPreviewMode: boolean;
  error: Error | null;
  config: ZoomConfig | null;
  meetingContext: unknown | null;
  userContext: unknown | null;
}

/**
 * Detect if the app is running inside a Zoom client
 * Returns true if running in Zoom, false for standalone preview
 */
function isRunningInZoom(): boolean {
  try {
    // Check if window.name indicates Zoom context
    if (window.name === 'zoomapp') {
      return true;
    }

    // Check if we're in an iframe with Zoom as ancestor
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      for (let i = 0; i < window.location.ancestorOrigins.length; i++) {
        if (window.location.ancestorOrigins[i]?.includes('zoom.us')) {
          return true;
        }
      }
    }

    // Check document referrer
    if (document.referrer.includes('zoom.us')) {
      return true;
    }

    // Check for Zoom SDK presence in the global scope
    if (typeof window !== 'undefined' && 'zoomSdk' in window) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function useZoom() {
  const [state, setState] = useState<ZoomState>({
    isReady: false,
    isLoading: true,
    isPreviewMode: false,
    error: null,
    config: null,
    meetingContext: null,
    userContext: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      // First, check if we're running inside Zoom
      const inZoom = isRunningInZoom();

      if (!inZoom) {
        console.log('[useZoom] Not running in Zoom client - entering preview mode');

        if (!mounted) {
          return;
        }

        setState({
          isReady: false,
          isLoading: false,
          isPreviewMode: true,
          error: null,
          config: null,
          meetingContext: null,
          userContext: null,
        });

        return;
      }

      // Running inside Zoom - initialize the SDK
      console.log('[useZoom] Running in Zoom client - initializing SDK');

      try {
        const config = await initZoomSdk();

        if (!mounted) {
          return;
        }

        const [meeting, user] = await Promise.all([
          getMeetingContext().catch(() => null),
          getUserContext().catch(() => null),
        ]);

        if (!mounted) {
          return;
        }

        setState({
          isReady: true,
          isLoading: false,
          isPreviewMode: false,
          error: null,
          config,
          meetingContext: meeting,
          userContext: user,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isPreviewMode: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const notify = useCallback(
    async (title: string, message: string) => {
      if (state.isPreviewMode) {
        // In preview mode, just log to console
        console.log('[Preview Mode] Notification:', { title, message });
        alert(`${title}\n\n${message}`);

        return;
      }

      if (!state.isReady) {
        console.warn('Zoom SDK not ready');

        return;
      }

      return showNotification(title, message);
    },
    [state.isReady, state.isPreviewMode],
  );

  const refreshContexts = useCallback(async () => {
    if (state.isPreviewMode || !state.isReady) {
      return;
    }

    const [meeting, user] = await Promise.all([
      getMeetingContext().catch(() => null),
      getUserContext().catch(() => null),
    ]);

    setState((prev) => ({
      ...prev,
      meetingContext: meeting,
      userContext: user,
    }));
  }, [state.isReady, state.isPreviewMode]);

  return {
    ...state,
    notify,
    refreshContexts,
  };
}
