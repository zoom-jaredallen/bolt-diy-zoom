/**
 * Zoom Store
 *
 * State management for Zoom Marketplace integration,
 * created apps, and webhook sessions.
 */

import { atom } from 'nanostores';
import { logStore } from './logs';
import { toast } from 'react-toastify';
import type { ZoomAppCredentials } from '~/types/zoom';

/**
 * Zoom App status types
 */
export type ZoomAppStatus = 'draft' | 'submitted' | 'approved' | 'published' | 'rejected';

/**
 * Individual Zoom App stored locally
 */
export interface ZoomApp {
  appId: string;
  appName: string;
  appType: string;
  status: ZoomAppStatus;
  createdAt: string;
  scopes: string[];
  credentials: {
    development: ZoomAppCredentials;
    production: ZoomAppCredentials;
  };
  webhookSessionId?: string;
  shortDescription?: string;
  longDescription?: string;
}

/**
 * Webhook event received from Zoom
 */
export interface ZoomWebhookEvent {
  id: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  appId?: string;
}

/**
 * Active webhook session
 */
export interface ZoomWebhookSession {
  sessionId: string;
  appId?: string;
  createdAt: string;
  lastEventAt?: string;
  eventCount: number;
}

/**
 * Zoom connection stats
 */
export interface ZoomStats {
  totalApps: number;
  publishedApps: number;
  draftApps: number;
  lastCreated: string | null;
  totalWebhookEvents: number;
}

/**
 * Main Zoom connection state
 */
export interface ZoomConnection {
  // Configuration status
  isConfigured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasAccountId: boolean;

  // Created apps (stored locally)
  apps: ZoomApp[];

  // Webhook sessions
  webhookSessions: ZoomWebhookSession[];

  // Recent webhook events
  recentEvents: ZoomWebhookEvent[];

  // Statistics
  stats: ZoomStats;

  // Last refresh time
  lastRefreshed: string | null;
}

// Default state
const defaultConnection: ZoomConnection = {
  isConfigured: false,
  hasClientId: false,
  hasClientSecret: false,
  hasAccountId: false,
  apps: [],
  webhookSessions: [],
  recentEvents: [],
  stats: {
    totalApps: 0,
    publishedApps: 0,
    draftApps: 0,
    lastCreated: null,
    totalWebhookEvents: 0,
  },
  lastRefreshed: null,
};

// Load stored apps from localStorage
const loadStoredApps = (): ZoomApp[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem('zoom_apps');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load stored Zoom apps:', error);
    return [];
  }
};

// Initialize with stored data
const storedApps = loadStoredApps();
const initialConnection: ZoomConnection = {
  ...defaultConnection,
  apps: storedApps,
  stats: {
    ...defaultConnection.stats,
    totalApps: storedApps.length,
    publishedApps: storedApps.filter((app) => app.status === 'published').length,
    draftApps: storedApps.filter((app) => app.status === 'draft').length,
    lastCreated: storedApps.length > 0 ? storedApps[storedApps.length - 1].createdAt : null,
  },
};

// Main store
export const zoomConnection = atom<ZoomConnection>(initialConnection);

// Loading states
export const isCheckingConfig = atom<boolean>(false);
export const isCreatingApp = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

/**
 * Update Zoom connection state
 */
export const updateZoomConnection = (updates: Partial<ZoomConnection>) => {
  const currentState = zoomConnection.get();
  const newState = { ...currentState, ...updates };
  zoomConnection.set(newState);
};

/**
 * Persist apps to localStorage
 */
const persistApps = (apps: ZoomApp[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('zoom_apps', JSON.stringify(apps));
  }
};

/**
 * API configuration response type
 */
interface ZoomConfigResponse {
  configured: boolean;
  credentials: {
    ZOOM_CLIENT_ID: 'configured' | 'missing';
    ZOOM_CLIENT_SECRET: 'configured' | 'missing';
    ZOOM_ACCOUNT_ID: 'configured' | 'missing';
  };
}

/**
 * Check if Zoom S2S OAuth is configured
 */
export async function checkZoomConfiguration(): Promise<boolean> {
  try {
    isCheckingConfig.set(true);

    const response = await fetch('/api/zoom-app-create');

    if (!response.ok) {
      throw new Error('Failed to check Zoom configuration');
    }

    const data = (await response.json()) as ZoomConfigResponse;

    updateZoomConnection({
      isConfigured: data.configured,
      hasClientId: data.credentials.ZOOM_CLIENT_ID === 'configured',
      hasClientSecret: data.credentials.ZOOM_CLIENT_SECRET === 'configured',
      hasAccountId: data.credentials.ZOOM_ACCOUNT_ID === 'configured',
    });

    return data.configured;
  } catch (error) {
    console.error('Error checking Zoom configuration:', error);
    logStore.logError('Failed to check Zoom configuration', { error });

    return false;
  } finally {
    isCheckingConfig.set(false);
  }
}

/**
 * Add a newly created Zoom App to the store
 */
export function addZoomApp(app: ZoomApp) {
  const currentState = zoomConnection.get();
  const updatedApps = [...currentState.apps, app];

  // Update stats
  const stats: ZoomStats = {
    totalApps: updatedApps.length,
    publishedApps: updatedApps.filter((a) => a.status === 'published').length,
    draftApps: updatedApps.filter((a) => a.status === 'draft').length,
    lastCreated: app.createdAt,
    totalWebhookEvents: currentState.stats.totalWebhookEvents,
  };

  updateZoomConnection({
    apps: updatedApps,
    stats,
  });

  // Persist to localStorage
  persistApps(updatedApps);

  logStore.logSystem('Zoom App added', { appId: app.appId, appName: app.appName });
}

/**
 * Update an existing Zoom App
 */
export function updateZoomApp(appId: string, updates: Partial<ZoomApp>) {
  const currentState = zoomConnection.get();
  const updatedApps = currentState.apps.map((app) => (app.appId === appId ? { ...app, ...updates } : app));

  // Update stats
  const stats: ZoomStats = {
    totalApps: updatedApps.length,
    publishedApps: updatedApps.filter((a) => a.status === 'published').length,
    draftApps: updatedApps.filter((a) => a.status === 'draft').length,
    lastCreated: currentState.stats.lastCreated,
    totalWebhookEvents: currentState.stats.totalWebhookEvents,
  };

  updateZoomConnection({
    apps: updatedApps,
    stats,
  });

  // Persist to localStorage
  persistApps(updatedApps);
}

/**
 * Remove a Zoom App from the store
 */
export function removeZoomApp(appId: string) {
  const currentState = zoomConnection.get();
  const updatedApps = currentState.apps.filter((app) => app.appId !== appId);

  // Update stats
  const stats: ZoomStats = {
    totalApps: updatedApps.length,
    publishedApps: updatedApps.filter((a) => a.status === 'published').length,
    draftApps: updatedApps.filter((a) => a.status === 'draft').length,
    lastCreated: updatedApps.length > 0 ? updatedApps[updatedApps.length - 1].createdAt : null,
    totalWebhookEvents: currentState.stats.totalWebhookEvents,
  };

  updateZoomConnection({
    apps: updatedApps,
    stats,
  });

  // Persist to localStorage
  persistApps(updatedApps);

  logStore.logSystem('Zoom App removed', { appId });
  toast.success('Zoom App removed');
}

/**
 * Get a specific Zoom App by ID
 */
export function getZoomApp(appId: string): ZoomApp | undefined {
  const currentState = zoomConnection.get();
  return currentState.apps.find((app) => app.appId === appId);
}

/**
 * Add a webhook event to the recent events
 */
export function addWebhookEvent(event: ZoomWebhookEvent) {
  const currentState = zoomConnection.get();

  // Keep only the last 100 events
  const recentEvents = [event, ...currentState.recentEvents].slice(0, 100);

  updateZoomConnection({
    recentEvents,
    stats: {
      ...currentState.stats,
      totalWebhookEvents: currentState.stats.totalWebhookEvents + 1,
    },
  });
}

/**
 * Clear all webhook events
 */
export function clearWebhookEvents() {
  const currentState = zoomConnection.get();
  updateZoomConnection({
    recentEvents: [],
    stats: {
      ...currentState.stats,
      totalWebhookEvents: 0,
    },
  });
}

/**
 * Add or update a webhook session
 */
export function updateWebhookSession(session: ZoomWebhookSession) {
  const currentState = zoomConnection.get();
  const existingIndex = currentState.webhookSessions.findIndex((s) => s.sessionId === session.sessionId);

  let webhookSessions: ZoomWebhookSession[];

  if (existingIndex >= 0) {
    webhookSessions = [...currentState.webhookSessions];
    webhookSessions[existingIndex] = session;
  } else {
    webhookSessions = [...currentState.webhookSessions, session];
  }

  updateZoomConnection({ webhookSessions });
}

/**
 * Remove a webhook session
 */
export function removeWebhookSession(sessionId: string) {
  const currentState = zoomConnection.get();
  const webhookSessions = currentState.webhookSessions.filter((s) => s.sessionId !== sessionId);
  updateZoomConnection({ webhookSessions });
}

/**
 * Initialize Zoom connection (check configuration)
 */
export async function initializeZoomConnection() {
  await checkZoomConfiguration();
}

/**
 * Refresh all Zoom data
 */
export async function refreshZoomData() {
  try {
    isFetchingStats.set(true);

    // Check configuration
    await checkZoomConfiguration();

    // Update last refreshed time
    updateZoomConnection({
      lastRefreshed: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing Zoom data:', error);
    logStore.logError('Failed to refresh Zoom data', { error });
    toast.error('Failed to refresh Zoom data');
  } finally {
    isFetchingStats.set(false);
  }
}
