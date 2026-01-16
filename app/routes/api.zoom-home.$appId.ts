/**
 * Zoom App Home URL Endpoint
 *
 * Serves as a static home URL for Zoom Apps that redirects to the dynamic
 * WebContainer preview URL. This allows Zoom Marketplace to have a stable
 * URL while the actual app runs in WebContainer with an ephemeral URL.
 *
 * GET /api/zoom-home/{appId}
 *
 * The endpoint will:
 * 1. Look up the appId in the registry
 * 2. If a preview URL is registered, proxy/redirect to it
 * 3. If no preview URL is available, show a waiting page
 *
 * POST /api/zoom-home/{appId}/register
 *   Register or update the preview URL for an app
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from '@remix-run/cloudflare';
import { getZoomAppRegistration, registerZoomApp, updateZoomAppPreview } from '~/lib/services/zoom-app-registry';

/**
 * OWASP Security Headers for Zoom Apps
 */
const OWASP_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "frame-ancestors 'self' https://*.zoom.us",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'ALLOW-FROM https://*.zoom.us',
};

/**
 * GET /api/zoom-home/{appId}
 *
 * Main entry point for Zoom Apps. Redirects to the preview URL if available.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const appId = params.appId;

  if (!appId) {
    return new Response('App ID is required', {
      status: 400,
      headers: OWASP_HEADERS,
    });
  }

  const registration = getZoomAppRegistration(appId);

  // If app is registered and has a preview URL, redirect to it
  if (registration?.previewUrl) {
    console.log(`[ZoomHome] Redirecting ${appId} to ${registration.previewUrl}`);

    // Preserve any query params
    const url = new URL(request.url);
    const targetUrl = new URL(registration.previewUrl);
    url.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    return redirect(targetUrl.toString(), {
      headers: OWASP_HEADERS,
    });
  }

  // App exists but no preview URL yet - show waiting page
  if (registration) {
    console.log(`[ZoomHome] App ${appId} waiting for preview URL`);

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${registration.appName} - Loading</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container { 
      text-align: center; 
      padding: 2rem;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s ease-in-out infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { margin: 0 0 1rem; font-size: 1.5rem; }
    p { margin: 0; opacity: 0.8; }
  </style>
  <script>
    // Auto-refresh every 3 seconds
    setTimeout(() => location.reload(), 3000);
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>${registration.appName}</h1>
    <p>Starting your app... Please wait.</p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...OWASP_HEADERS,
        },
      },
    );
  }

  // App not found
  console.log(`[ZoomHome] App not found: ${appId}`);

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>App Not Found</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container { text-align: center; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>App Not Found</h1>
    <p>This Zoom App is not currently registered.</p>
    <p>App ID: ${appId}</p>
  </div>
</body>
</html>`,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...OWASP_HEADERS,
      },
    },
  );
}

/**
 * POST /api/zoom-home/{appId}
 *
 * Register or update preview URL for an app
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const appId = params.appId;

  if (!appId) {
    return new Response(JSON.stringify({ error: 'App ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { appName, clientId, previewId } = body as {
      appName?: string;
      clientId?: string;
      previewId?: string;
    };

    // Update existing registration
    const existing = getZoomAppRegistration(appId);

    if (existing && previewId) {
      const updated = updateZoomAppPreview(appId, previewId);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'updated',
          registration: updated,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Create new registration
    if (appName) {
      const registration = registerZoomApp({
        appId,
        appName,
        clientId,
        previewId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: 'created',
          registration,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ error: 'appName or previewId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ZoomHome] Error processing request:', error);

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
