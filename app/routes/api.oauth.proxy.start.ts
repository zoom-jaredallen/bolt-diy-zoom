/**
 * OAuth Proxy Start Endpoint
 *
 * Initiates OAuth flow for WebContainer apps by creating a session
 * and redirecting to the OAuth provider's authorization URL.
 *
 * Usage:
 * GET /api/oauth/proxy/start?provider=zoom&scopes=meeting:read,meeting:write&webcontainerId=xxx
 */

import { type LoaderFunctionArgs, redirect } from '@remix-run/cloudflare';
import {
  createOAuthSession,
  getOAuthProviderConfig,
  buildAuthorizationUrl,
  getSupportedProviders,
} from '~/lib/services/oauth-proxy';

function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const scopesParam = url.searchParams.get('scopes');
  const webcontainerId = url.searchParams.get('webcontainerId') || undefined;

  // Validate provider
  if (!provider) {
    return new Response(
      JSON.stringify({
        error: 'Missing provider parameter',
        supportedProviders: getSupportedProviders(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Get environment variables
  const env = {
    ZOOM_OAUTH_CLIENT_ID: getEnvVar(context, 'ZOOM_OAUTH_CLIENT_ID'),
    ZOOM_CLIENT_ID: getEnvVar(context, 'ZOOM_CLIENT_ID'),
    ZOOM_OAUTH_CLIENT_SECRET: getEnvVar(context, 'ZOOM_OAUTH_CLIENT_SECRET'),
    ZOOM_CLIENT_SECRET: getEnvVar(context, 'ZOOM_CLIENT_SECRET'),
    GITHUB_OAUTH_CLIENT_ID: getEnvVar(context, 'GITHUB_OAUTH_CLIENT_ID'),
    GITHUB_OAUTH_CLIENT_SECRET: getEnvVar(context, 'GITHUB_OAUTH_CLIENT_SECRET'),
    GITLAB_OAUTH_CLIENT_ID: getEnvVar(context, 'GITLAB_OAUTH_CLIENT_ID'),
    GITLAB_OAUTH_CLIENT_SECRET: getEnvVar(context, 'GITLAB_OAUTH_CLIENT_SECRET'),
    GOOGLE_OAUTH_CLIENT_ID: getEnvVar(context, 'GOOGLE_OAUTH_CLIENT_ID'),
    GOOGLE_OAUTH_CLIENT_SECRET: getEnvVar(context, 'GOOGLE_OAUTH_CLIENT_SECRET'),
    VITE_GITLAB_URL: getEnvVar(context, 'VITE_GITLAB_URL'),
    VITE_PUBLIC_URL: getEnvVar(context, 'VITE_PUBLIC_URL'),
  };

  // Get provider configuration
  const config = getOAuthProviderConfig(provider, env);

  if (!config) {
    return new Response(
      JSON.stringify({
        error: `Unsupported provider: ${provider}`,
        supportedProviders: getSupportedProviders(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Validate client credentials are configured
  if (!config.clientId || !config.clientSecret) {
    return new Response(
      JSON.stringify({
        error: `OAuth credentials not configured for provider: ${provider}`,
        hint: `Please set ${provider.toUpperCase()}_OAUTH_CLIENT_ID and ${provider.toUpperCase()}_OAUTH_CLIENT_SECRET environment variables`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Parse scopes
  const scopes = scopesParam ? scopesParam.split(',').map((s) => s.trim()) : config.scopes;

  // Get public URL for redirect
  const publicUrl = env.VITE_PUBLIC_URL || new URL(request.url).origin;

  // Create OAuth session
  const session = await createOAuthSession(provider, scopes, publicUrl, webcontainerId);

  // Build authorization URL
  const authorizationUrl = buildAuthorizationUrl(config, session, publicUrl);

  // Redirect to OAuth provider
  return redirect(authorizationUrl);
}
