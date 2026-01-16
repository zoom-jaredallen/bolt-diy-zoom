/**
 * Zoom App Registry Service
 *
 * Maintains a mapping between Zoom App IDs and their WebContainer preview URLs.
 * This allows Zoom Apps to use a static home URL that redirects to the dynamic
 * WebContainer preview.
 *
 * Usage:
 * 1. When Zoom App is created, register the appId with no preview URL
 * 2. When WebContainer starts, update the registry with the actual preview URL
 * 3. Zoom client requests /api/zoom-home/{appId} → redirects to preview URL
 */

export interface ZoomAppRegistration {
  appId: string;
  appName: string;
  previewId?: string;
  previewUrl?: string;
  clientId?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessAt: number;
}

// In-memory storage (consider Redis/KV for production multi-instance)
const appRegistry = new Map<string, ZoomAppRegistration>();

// Configuration
const REGISTRATION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Register a new Zoom App
 */
export function registerZoomApp(options: {
  appId: string;
  appName: string;
  clientId?: string;
  previewId?: string;
}): ZoomAppRegistration {
  const { appId, appName, clientId, previewId } = options;
  const now = Date.now();

  const registration: ZoomAppRegistration = {
    appId,
    appName,
    clientId,
    previewId,
    previewUrl: previewId ? buildPreviewUrl(previewId) : undefined,
    createdAt: now,
    updatedAt: now,
    lastAccessAt: now,
  };

  appRegistry.set(appId, registration);
  console.log(`[ZoomAppRegistry] Registered app: ${appId} (${appName})`);

  // Clean up expired registrations
  cleanupExpiredRegistrations();

  return registration;
}

/**
 * Update an existing app registration with preview URL
 */
export function updateZoomAppPreview(appId: string, previewId: string): ZoomAppRegistration | null {
  const registration = appRegistry.get(appId);

  if (!registration) {
    console.warn(`[ZoomAppRegistry] App not found: ${appId}`);
    return null;
  }

  registration.previewId = previewId;
  registration.previewUrl = buildPreviewUrl(previewId);
  registration.updatedAt = Date.now();

  appRegistry.set(appId, registration);
  console.log(`[ZoomAppRegistry] Updated preview for ${appId}: ${registration.previewUrl}`);

  return registration;
}

/**
 * Get app registration by appId
 */
export function getZoomAppRegistration(appId: string): ZoomAppRegistration | null {
  const registration = appRegistry.get(appId);

  if (!registration) {
    return null;
  }

  // Check if registration has expired
  if (Date.now() - registration.lastAccessAt > REGISTRATION_TTL) {
    appRegistry.delete(appId);
    console.log(`[ZoomAppRegistry] Expired registration removed: ${appId}`);
    return null;
  }

  // Update last access time
  registration.lastAccessAt = Date.now();

  return registration;
}

/**
 * Find app registration by client ID
 */
export function findZoomAppByClientId(clientId: string): ZoomAppRegistration | null {
  for (const registration of appRegistry.values()) {
    if (registration.clientId === clientId) {
      // Check expiration
      if (Date.now() - registration.lastAccessAt > REGISTRATION_TTL) {
        appRegistry.delete(registration.appId);
        continue;
      }

      registration.lastAccessAt = Date.now();

      return registration;
    }
  }

  return null;
}

/**
 * Delete app registration
 */
export function deleteZoomAppRegistration(appId: string): boolean {
  const deleted = appRegistry.delete(appId);

  if (deleted) {
    console.log(`[ZoomAppRegistry] Deleted registration: ${appId}`);
  }

  return deleted;
}

/**
 * Get all active registrations (for admin/debugging)
 */
export function getAllRegistrations(): ZoomAppRegistration[] {
  cleanupExpiredRegistrations();
  return Array.from(appRegistry.values());
}

/**
 * Build the WebContainer preview URL from preview ID
 */
function buildPreviewUrl(previewId: string): string {
  return `https://${previewId}.local-credentialless.webcontainer-api.io`;
}

/**
 * Build the Zoom App home URL that can be used in marketplace
 */
export function buildZoomAppHomeUrl(baseUrl: string, appId: string): string {
  return `${baseUrl}/api/zoom-home/${appId}`;
}

/**
 * Clean up expired registrations
 */
function cleanupExpiredRegistrations(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [appId, registration] of appRegistry.entries()) {
    if (now - registration.lastAccessAt > REGISTRATION_TTL) {
      appRegistry.delete(appId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[ZoomAppRegistry] Cleaned up ${cleanedCount} expired registrations`);
  }
}
