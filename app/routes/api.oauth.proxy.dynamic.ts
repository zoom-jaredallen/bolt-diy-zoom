/**
 * Dynamic OAuth Proxy Start Endpoint
 *
 * Initiates OAuth flow for newly created Zoom Apps (or other providers)
 * using dynamically provided credentials instead of environment variables.
 *
 * POST /api/oauth/proxy/dynamic
 *
 * Request body:
 * {
 *   provider: string,           // Required: OAuth provider (zoom, github, etc.)
 *   clientId: string,           // Required: OAuth client ID
 *   clientSecret: string,       // Required: OAuth client secret
 *   scopes?: string[],          // Optional: OAuth scopes
 *   appId?: string,             // Optional: App ID for reference
 *   appName?: string,           // Optional: App name for reference
 *   webcontainerId?: string,    // Optional: WebContainer ID
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   authorizationUrl: string,   // URL to redirect user to for OAuth
 *   sessionId: string,          // Session ID for tracking
 *   state: string               // State parameter for CSRF protection
 * }
 */

import { type ActionFunctionArgs, json, redirect } from '@remix-run/cloudflare';
import {
  createDynamicOAuthSession,
  buildDynamicAuthorizationUrl,
  getSupportedProviders,
} from '~/lib/services/oauth-proxy';

function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
}

interface DynamicOAuthRequest {
  provider: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  appId?: string;
  appName?: string;
  webcontainerId?: string;
  redirectAfterAuth?: boolean;
}

/**
 * POST /api/oauth/proxy/dynamic
 *
 * Start OAuth flow with dynamic credentials
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as DynamicOAuthRequest;

    const {
      provider,
      clientId,
      clientSecret,
      scopes,
      appId,
      appName,
      webcontainerId,
      redirectAfterAuth = false,
    } = body;

    // Validate required fields
    if (!provider) {
      return json(
        {
          success: false,
          error: 'Missing required field: provider',
          supportedProviders: getSupportedProviders(),
        },
        { status: 400 },
      );
    }

    if (!clientId || !clientSecret) {
      return json(
        {
          success: false,
          error: 'Missing required fields: clientId and clientSecret',
        },
        { status: 400 },
      );
    }

    // Validate provider is supported
    const supportedProviders = getSupportedProviders();

    if (!supportedProviders.includes(provider.toLowerCase())) {
      return json(
        {
          success: false,
          error: `Unsupported provider: ${provider}`,
          supportedProviders,
        },
        { status: 400 },
      );
    }

    // Get public URL
    const publicUrl = getEnvVar(context, 'VITE_PUBLIC_URL') || new URL(request.url).origin;

    // Default scopes based on provider
    const defaultScopes: Record<string, string[]> = {
      zoom: ['meeting:read:meeting', 'zoomapp:inmeeting'],
      github: ['repo', 'user'],
      gitlab: ['api', 'read_user', 'read_repository'],
      google: ['openid', 'email', 'profile'],
    };

    const finalScopes = scopes && scopes.length > 0 ? scopes : defaultScopes[provider.toLowerCase()] || [];

    // Create session with dynamic credentials
    const session = await createDynamicOAuthSession(
      provider.toLowerCase(),
      finalScopes,
      publicUrl,
      {
        clientId,
        clientSecret,
        appId,
        appName,
      },
      webcontainerId,
    );

    // Build authorization URL
    const authorizationUrl = buildDynamicAuthorizationUrl(session, publicUrl);

    console.log(`[Dynamic OAuth] Created session for ${provider} app: ${appName || appId}`);
    console.log(`[Dynamic OAuth] Authorization URL: ${authorizationUrl}`);

    // If redirectAfterAuth is true, redirect immediately
    if (redirectAfterAuth) {
      return redirect(authorizationUrl);
    }

    // Return the authorization URL for client-side redirect
    return json({
      success: true,
      authorizationUrl,
      sessionId: session.id,
      state: session.state,
    });
  } catch (error) {
    console.error('[Dynamic OAuth] Error:', error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/oauth/proxy/dynamic
 *
 * Start OAuth flow via GET request with query parameters.
 * This allows browser-clickable URLs like:
 * /api/oauth/proxy/dynamic?provider=zoom&clientId=XXX&clientSecret=YYY&scopes=meeting:read:meeting,zoomapp:inmeeting
 *
 * If no query parameters are provided, returns endpoint info.
 */
export async function loader({ request, context }: ActionFunctionArgs) {
  const url = new URL(request.url);

  // Extract query parameters
  const provider = url.searchParams.get('provider');
  const clientId = url.searchParams.get('clientId');
  const clientSecret = url.searchParams.get('clientSecret');
  const scopesParam = url.searchParams.get('scopes');
  const appId = url.searchParams.get('appId') || undefined;
  const appName = url.searchParams.get('appName') || undefined;
  const webcontainerId = url.searchParams.get('webcontainerId') || undefined;

  // If no provider specified, return endpoint info
  if (!provider) {
    return json({
      endpoint: '/api/oauth/proxy/dynamic',
      methods: ['GET', 'POST'],
      description: 'Start OAuth flow with dynamic credentials for newly created apps',
      supportedProviders: getSupportedProviders(),
      usage: {
        GET: 'Add query params: ?provider=zoom&clientId=XXX&clientSecret=YYY&scopes=...',
        POST: 'Send JSON body with same fields',
      },
      requestSchema: {
        provider: { type: 'string', required: true, description: 'OAuth provider (zoom, github, gitlab, google)' },
        clientId: { type: 'string', required: true, description: 'OAuth client ID' },
        clientSecret: { type: 'string', required: true, description: 'OAuth client secret' },
        scopes: { type: 'string or comma-separated string', required: false, description: 'OAuth scopes' },
        appId: { type: 'string', required: false, description: 'App ID for reference' },
        appName: { type: 'string', required: false, description: 'App name for reference' },
        webcontainerId: { type: 'string', required: false, description: 'WebContainer ID' },
      },
    });
  }

  // Validate required fields
  if (!clientId || !clientSecret) {
    return json(
      {
        success: false,
        error: 'Missing required query parameters: clientId and clientSecret',
      },
      { status: 400 },
    );
  }

  // Validate provider is supported
  const supportedProviders = getSupportedProviders();

  if (!supportedProviders.includes(provider.toLowerCase())) {
    return json(
      {
        success: false,
        error: `Unsupported provider: ${provider}`,
        supportedProviders,
      },
      { status: 400 },
    );
  }

  // Get public URL
  const publicUrl = getEnvVar(context, 'VITE_PUBLIC_URL') || url.origin;

  // Parse scopes (comma-separated string or default)
  const defaultScopes: Record<string, string[]> = {
    zoom: ['meeting:read:meeting', 'zoomapp:inmeeting'],
    github: ['repo', 'user'],
    gitlab: ['api', 'read_user', 'read_repository'],
    google: ['openid', 'email', 'profile'],
  };

  const scopes = scopesParam
    ? scopesParam.split(',').map((s) => s.trim())
    : defaultScopes[provider.toLowerCase()] || [];

  try {
    // Create session with dynamic credentials
    const session = await createDynamicOAuthSession(
      provider.toLowerCase(),
      scopes,
      publicUrl,
      {
        clientId,
        clientSecret,
        appId,
        appName,
      },
      webcontainerId,
    );

    // Build authorization URL
    const authorizationUrl = buildDynamicAuthorizationUrl(session, publicUrl);

    console.log(`[Dynamic OAuth GET] Created session for ${provider} app: ${appName || appId || 'unknown'}`);
    console.log(`[Dynamic OAuth GET] Session ID: ${session.id}, State: ${session.state}`);
    console.log(`[Dynamic OAuth GET] Redirecting to: ${authorizationUrl}`);

    // Redirect directly to the authorization URL
    return redirect(authorizationUrl);
  } catch (error) {
    console.error('[Dynamic OAuth GET] Error:', error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
