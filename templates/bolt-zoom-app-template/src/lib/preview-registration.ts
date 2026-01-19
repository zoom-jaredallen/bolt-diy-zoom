/**
 * Preview Registration Utility
 *
 * Automatically registers the WebContainer preview URL with bolt.diy
 * so that Zoom can find and load the app.
 *
 * This is called when the app starts to register its preview URL with
 * the /api/zoom-home/{projectId} endpoint.
 */

/**
 * Get the project ID from environment variables
 */
function getProjectId(): string | undefined {
  return import.meta.env.ZOOM_PROJECT_ID || import.meta.env.VITE_ZOOM_PROJECT_ID;
}

/**
 * Get the current preview ID from the WebContainer URL
 *
 * WebContainer URLs look like: https://abc123xyz.local-credentialless.webcontainer-api.io
 * The previewId is the subdomain (abc123xyz)
 */
function getPreviewIdFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname;

  // WebContainer URL pattern: {previewId}.local-credentialless.webcontainer-api.io
  const match = hostname.match(/^([a-z0-9]+)\.local.*\.webcontainer-api\.io$/i);

  if (match) {
    return match[1];
  }

  // Check for local development
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.')) {
    // In local dev, use a mock preview ID or skip registration
    console.log('[PreviewRegistration] Running in localhost, skipping registration');

    return null;
  }

  return null;
}

/**
 * Get the bolt.diy base URL for API calls
 */
function getBoltBaseUrl(): string {
  return import.meta.env.ZOOM_BOLT_BASE_URL || 'https://zoomvibes.j4red4llen.com';
}

/**
 * Register the preview URL with bolt.diy
 *
 * This updates the zoom-app-registry so that /api/zoom-home/{projectId}
 * can redirect to this WebContainer preview.
 */
export async function registerPreviewUrl(): Promise<boolean> {
  const projectId = getProjectId();
  const previewId = getPreviewIdFromUrl();

  if (!projectId) {
    console.warn('[PreviewRegistration] No project ID found, skipping registration');
    console.warn('[PreviewRegistration] Set ZOOM_PROJECT_ID or VITE_ZOOM_PROJECT_ID in .env');

    return false;
  }

  if (!previewId) {
    console.warn('[PreviewRegistration] Could not determine preview ID from URL');

    return false;
  }

  const baseUrl = getBoltBaseUrl();
  const registrationUrl = `${baseUrl}/api/zoom-home/${projectId}`;

  console.log('[PreviewRegistration] Registering preview URL...');
  console.log('[PreviewRegistration] Project ID:', projectId);
  console.log('[PreviewRegistration] Preview ID:', previewId);
  console.log('[PreviewRegistration] Registration URL:', registrationUrl);

  try {
    const response = await fetch(registrationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        previewId,
        appName: import.meta.env.VITE_ZOOM_APP_NAME || 'Zoom App',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PreviewRegistration] Registration failed:', response.status, errorText);

      return false;
    }

    const result = await response.json();
    console.log('[PreviewRegistration] Registration successful:', result);

    return true;
  } catch (error) {
    console.error('[PreviewRegistration] Registration error:', error);

    return false;
  }
}

/**
 * Initialize preview registration
 *
 * Call this when the app starts. It will:
 * 1. Check if running in WebContainer
 * 2. Register the preview URL with bolt.diy
 * 3. Set up periodic re-registration (WebContainer URLs can be ephemeral)
 */
export function initPreviewRegistration(): void {
  // Register immediately
  registerPreviewUrl();

  /*
   * Re-register periodically to keep the registration fresh.
   * WebContainer sessions can timeout, so re-register every 5 minutes.
   */
  const REREGISTER_INTERVAL = 5 * 60 * 1000;

  setInterval(() => {
    console.log('[PreviewRegistration] Periodic re-registration...');
    registerPreviewUrl();
  }, REREGISTER_INTERVAL);
}
