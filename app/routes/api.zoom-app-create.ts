/**
 * Zoom App Creation API Route
 *
 * Creates a new Zoom App via the Marketplace API using Server-to-Server OAuth.
 * This endpoint is called automatically when a user selects the "Zoom App" template.
 *
 * POST /api/zoom-app-create
 *
 * Request body:
 * {
 *   appName: string,           // Required: Name of the Zoom App
 *   previewId?: string,        // Optional: WebContainer preview ID for home URIs
 *   scopes?: string[],         // Optional: OAuth scopes
 *   description?: string,      // Optional: Short description (max 100 chars)
 *   longDescription?: string   // Optional: Long description (max 4000 chars)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   appId: string,
 *   appName: string,
 *   oauthAuthorizeUrl: string,
 *   credentials: { clientId, clientSecret },
 *   envContent: string  // Pre-formatted .env file content
 * }
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import {
  buildZoomAppCreateRequest,
  createZoomAppWithRetry,
  generateEnvFileContent,
  generateProxyOAuthUrl,
  ZoomMarketplaceError,
  ZOOM_APP_DEFAULTS,
  type ZoomCredentials,
} from '~/lib/services/zoom-marketplace-api';

/**
 * Helper to get environment variables from context
 */
function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
}

/**
 * POST /api/zoom-app-create
 *
 * Creates a new Zoom App via the Marketplace API
 */
export async function action({ request, context }: ActionFunctionArgs) {
  console.log('[ZoomAppCreate] POST request received');

  // Only allow POST requests
  if (request.method !== 'POST') {
    console.log('[ZoomAppCreate] Method not allowed:', request.method);

    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json();

    console.log('[ZoomAppCreate] Request body:', JSON.stringify(body, null, 2));

    const { appName, previewId, scopes, description, longDescription } = body as {
      appName?: string;
      previewId?: string;
      scopes?: string[];
      description?: string;
      longDescription?: string;
    };

    // Validate required fields
    if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
      return json(
        {
          success: false,
          error: 'App name is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Get Zoom S2S OAuth credentials from environment
    const credentials: ZoomCredentials = {
      clientId: getEnvVar(context, 'ZOOM_CLIENT_ID'),
      clientSecret: getEnvVar(context, 'ZOOM_CLIENT_SECRET'),
      accountId: getEnvVar(context, 'ZOOM_ACCOUNT_ID'),
    };

    // Validate credentials are configured
    if (!credentials.clientId || !credentials.clientSecret || !credentials.accountId) {
      console.error('[ZoomAppCreate] Missing Zoom S2S OAuth credentials');

      return json(
        {
          success: false,
          error:
            'Zoom S2S OAuth credentials not configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID environment variables.',
          code: 'MISSING_CREDENTIALS',
          hint: 'Create a Server-to-Server OAuth app at https://marketplace.zoom.us/develop/create',
        },
        { status: 500 },
      );
    }

    const trimmedAppName = appName.trim();

    // Build the app creation request
    const createRequest = buildZoomAppCreateRequest({
      appName: trimmedAppName,
      previewId,
      scopes,
      description,
      longDescription,
    });

    console.log('[ZoomAppCreate] Creating Zoom App:', trimmedAppName);

    // Create the app with retry logic
    const result = await createZoomAppWithRetry(credentials, createRequest);

    // Generate .env file content
    const envContent = generateEnvFileContent(result, trimmedAppName);

    // Generate a proper OAuth URL that goes through our proxy (includes state parameter)
    const proxyOAuthUrl = generateProxyOAuthUrl(result.credentials, result.app_id, trimmedAppName);

    console.log('[ZoomAppCreate] Zoom App created successfully:', result.app_id);
    console.log('[ZoomAppCreate] envContent generated, length:', envContent.length);
    console.log('[ZoomAppCreate] envContent preview:', envContent.substring(0, 200));
    console.log('[ZoomAppCreate] Proxy OAuth URL:', proxyOAuthUrl);

    return json({
      success: true,
      appId: result.app_id,
      appName: trimmedAppName,

      // Return the proxy URL (with state handling) instead of direct Zoom URL
      oauthAuthorizeUrl: proxyOAuthUrl,

      // Also include the direct URL for reference
      directOAuthUrl: result.oauth_authorize_url,
      credentials: {
        clientId: result.credentials.client_id,
        clientSecret: result.credentials.client_secret,
      },
      envContent,
    });
  } catch (error) {
    console.error('[ZoomAppCreate] Error creating Zoom App:', error);

    // Handle known errors
    if (error instanceof ZoomMarketplaceError) {
      const statusCode = error.statusCode || 500;

      return json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 },
      );
    }

    // Handle unknown errors
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/zoom-app-create
 *
 * Returns information about the endpoint and current configuration status
 */
export async function loader({ context }: ActionFunctionArgs) {
  // Check if credentials are configured
  const hasClientId = !!getEnvVar(context, 'ZOOM_CLIENT_ID');
  const hasClientSecret = !!getEnvVar(context, 'ZOOM_CLIENT_SECRET');
  const hasAccountId = !!getEnvVar(context, 'ZOOM_ACCOUNT_ID');

  return json({
    endpoint: '/api/zoom-app-create',
    method: 'POST',
    description: 'Creates a new Zoom App via the Marketplace API',
    configured: hasClientId && hasClientSecret && hasAccountId,
    credentials: {
      ZOOM_CLIENT_ID: hasClientId ? 'configured' : 'missing',
      ZOOM_CLIENT_SECRET: hasClientSecret ? 'configured' : 'missing',
      ZOOM_ACCOUNT_ID: hasAccountId ? 'configured' : 'missing',
    },
    requestSchema: {
      appName: { type: 'string', required: true, description: 'Name of the Zoom App' },
      previewId: { type: 'string', required: false, description: 'WebContainer preview ID for home URIs' },
      scopes: {
        type: 'string[]',
        required: false,
        description: 'OAuth scopes',
        default: ZOOM_APP_DEFAULTS.default_scopes,
      },
      description: { type: 'string', required: false, description: 'Short description (max 100 chars)' },
      longDescription: { type: 'string', required: false, description: 'Long description (max 4000 chars)' },
    },
  });
}
