import { useState, useEffect, useCallback } from 'react';
import { initZoomSdk, getMeetingContext, getUserContext, showNotification, type ZoomConfig } from '../lib/zoom';

interface ZoomState {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  config: ZoomConfig | null;
  meetingContext: unknown | null;
  userContext: unknown | null;
}

export function useZoom() {
  const [state, setState] = useState<ZoomState>({
    isReady: false,
    isLoading: true,
    error: null,
    config: null,
    meetingContext: null,
    userContext: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const config = await initZoomSdk();

        if (!mounted) return;

        const [meeting, user] = await Promise.all([
          getMeetingContext().catch(() => null),
          getUserContext().catch(() => null),
        ]);

        if (!mounted) return;

        setState({
          isReady: true,
          isLoading: false,
          error: null,
          config,
          meetingContext: meeting,
          userContext: user,
        });
      } catch (error) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
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
      if (!state.isReady) {
        console.warn('Zoom SDK not ready');
        return;
      }
      return showNotification(title, message);
    },
    [state.isReady],
  );

  const refreshContexts = useCallback(async () => {
    if (!state.isReady) return;

    const [meeting, user] = await Promise.all([
      getMeetingContext().catch(() => null),
      getUserContext().catch(() => null),
    ]);

    setState((prev) => ({
      ...prev,
      meetingContext: meeting,
      userContext: user,
    }));
  }, [state.isReady]);

  return {
    ...state,
    notify,
    refreshContexts,
  };
}
