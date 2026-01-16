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
 * Returns information about the endpoint
 */
export async function loader() {
  return json({
    endpoint: '/api/oauth/proxy/dynamic',
    method: 'POST',
    description: 'Start OAuth flow with dynamic credentials for newly created apps',
    supportedProviders: getSupportedProviders(),
    requestSchema: {
      provider: { type: 'string', required: true, description: 'OAuth provider (zoom, github, gitlab, google)' },
      clientId: { type: 'string', required: true, description: 'OAuth client ID' },
      clientSecret: { type: 'string', required: true, description: 'OAuth client secret' },
      scopes: { type: 'string[]', required: false, description: 'OAuth scopes' },
      appId: { type: 'string', required: false, description: 'App ID for reference' },
      appName: { type: 'string', required: false, description: 'App name for reference' },
      webcontainerId: { type: 'string', required: false, description: 'WebContainer ID' },
      redirectAfterAuth: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'If true, redirects to authorization URL immediately',
      },
    },
    responseSchema: {
      success: { type: 'boolean' },
      authorizationUrl: { type: 'string', description: 'URL to redirect user to for OAuth' },
      sessionId: { type: 'string', description: 'Session ID for tracking' },
      state: { type: 'string', description: 'State parameter for CSRF protection' },
    },
  });
}
