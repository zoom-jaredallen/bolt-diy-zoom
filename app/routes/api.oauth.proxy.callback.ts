/**
 * OAuth Proxy Callback Endpoint
 *
 * Handles the OAuth callback from providers, exchanges the authorization code
 * for tokens, and notifies the WebContainer app via postMessage.
 *
 * Flow:
 * 1. Receive callback with code and state from OAuth provider
 * 2. Validate state matches a pending session
 * 3. Exchange code for tokens
 * 4. Store tokens and render success page that posts message to opener
 */

import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import {
  getOAuthSessionByState,
  getOAuthProviderConfig,
  exchangeCodeForTokens,
  exchangeCodeForTokensWithDynamicCredentials,
  storeOAuthTokens,
  deleteOAuthSession,
} from '~/lib/services/oauth-proxy';

function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
}

/**
 * Ensure URL uses HTTPS protocol
 * Zoom and most OAuth providers require HTTPS for redirect URIs
 */
function ensureHttps(url: string): string {
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    return url;
  }

  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * Exchange authorization code for tokens directly using provided credentials
 * Used for Marketplace-initiated OAuth flow where we don't have a session
 */
async function exchangeCodeForTokensDirect(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; token_type: string; expires_in?: number; scope?: string }> {
  const tokenUrl = 'https://zoom.us/oauth/token';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const authHeader = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: authHeader,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[exchangeCodeForTokensDirect] Token exchange failed:', errorText);
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };

  return tokens;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    return renderErrorPage(error, errorDescription || 'Unknown error occurred');
  }

  // Validate code is present
  if (!code) {
    return renderErrorPage('invalid_request', 'Missing authorization code');
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

  // Get public URL for redirect (ensure HTTPS for OAuth providers)
  const rawPublicUrl = env.VITE_PUBLIC_URL || new URL(request.url).origin;
  const publicUrl = ensureHttps(rawPublicUrl);
  const redirectUri = `${publicUrl}/api/oauth/proxy/callback`;

  /*
   * Handle Marketplace-initiated OAuth flow (no state parameter)
   * When Zoom Marketplace's "Add" or "Install" button is clicked, Zoom initiates
   * the OAuth flow directly without going through our proxy, so there's no state.
   *
   * IMPORTANT: For Marketplace OAuth to work, you need to set the app's OAuth credentials:
   * - ZOOM_OAUTH_CLIENT_ID: The Client ID of the created Zoom App (not S2S credentials)
   * - ZOOM_OAUTH_CLIENT_SECRET: The Client Secret of the created Zoom App
   *
   * The S2S credentials (ZOOM_CLIENT_ID) are for API management, NOT for user OAuth.
   */
  if (!state) {
    console.log('[OAuth Callback] No state parameter - handling Marketplace-initiated flow');

    // Prefer ZOOM_OAUTH credentials (app-specific), fall back to S2S (won't work for user OAuth)
    const clientId = env.ZOOM_OAUTH_CLIENT_ID;
    const clientSecret = env.ZOOM_OAUTH_CLIENT_SECRET;

    // If no OAuth-specific credentials, show a helpful error
    if (!clientId || !clientSecret) {
      console.error('[OAuth Callback] Missing ZOOM_OAUTH_CLIENT_ID or ZOOM_OAUTH_CLIENT_SECRET');

      const helpText = `
To authorize via Zoom Marketplace, you need to configure the app's OAuth credentials:

1. Set ZOOM_OAUTH_CLIENT_ID to your Zoom App's Client ID
2. Set ZOOM_OAUTH_CLIENT_SECRET to your Zoom App's Client Secret

These are different from S2S credentials (ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET).

Alternatively, use the OAuth URL from the .env file in your project which includes the credentials.
      `.trim();

      return renderErrorPage('configuration_error', helpText);
    }

    try {
      console.log('[OAuth Callback] Using app OAuth credentials for token exchange');
      console.log('[OAuth Callback] Client ID:', clientId.substring(0, 8) + '...');
      console.log('[OAuth Callback] Redirect URI:', redirectUri);

      // Exchange code for tokens using OAuth credentials
      const tokens = await exchangeCodeForTokensDirect(clientId, clientSecret, code, redirectUri);

      console.log('[OAuth Callback] Marketplace flow token exchange successful');

      // Generate a session ID for tracking
      const sessionId = `marketplace-${Date.now()}`;

      // Render success page
      return renderSuccessPage('zoom', sessionId, undefined, tokens);
    } catch (err) {
      console.error('[OAuth Callback] Marketplace flow token exchange error:', err);

      // Provide helpful debugging info
      const debugInfo = `
Token exchange failed. This usually means:

1. The OAuth credentials don't match the app that initiated the authorization
2. The redirect URI doesn't match what's configured in the Zoom App

Debug info:
- Client ID: ${clientId.substring(0, 8)}...
- Redirect URI: ${redirectUri}
- Error: ${err instanceof Error ? err.message : 'Unknown error'}

Try using the OAuth URL from your project's .env file instead of Marketplace's Add button.
      `.trim();

      return renderErrorPage('token_exchange_failed', debugInfo);
    }
  }

  // Standard flow with state parameter
  const session = getOAuthSessionByState(state);

  if (!session) {
    return renderErrorPage('invalid_state', 'OAuth session expired or invalid. Please try again.');
  }

  try {
    let tokens;

    // Check if session has dynamic credentials (for newly created apps)
    if (session.dynamicCredentials) {
      console.log('[OAuth Callback] Using dynamic credentials for app:', session.dynamicCredentials.appName);

      // Exchange code using dynamic credentials
      tokens = await exchangeCodeForTokensWithDynamicCredentials(session, code, publicUrl);
    } else {
      // Get provider configuration from environment
      const config = getOAuthProviderConfig(session.provider, env);

      if (!config) {
        return renderErrorPage('invalid_provider', `Unknown provider: ${session.provider}`);
      }

      // Exchange code using environment credentials
      tokens = await exchangeCodeForTokens(config, code, session.redirectUri);
    }

    // Store tokens
    storeOAuthTokens(session.id, tokens);

    // Clean up session
    deleteOAuthSession(session.id);

    // Render success page that posts message to opener/parent
    return renderSuccessPage(session.provider, session.id, session.webcontainerId, tokens);
  } catch (err) {
    console.error('OAuth token exchange error:', err);

    return renderErrorPage(
      'token_exchange_failed',
      err instanceof Error ? err.message : 'Failed to exchange authorization code for tokens',
    );
  }
}

function renderSuccessPage(
  provider: string,
  sessionId: string,
  webcontainerId: string | undefined,
  tokens: { access_token: string; refresh_token?: string; token_type: string; expires_in?: number; scope?: string },
): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Success - ${provider}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .success-icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
    }
    h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
    p { color: #94a3b8; margin-bottom: 1rem; }
    .provider { 
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(255,255,255,0.1);
      border-radius: 9999px;
      font-size: 0.875rem;
      text-transform: capitalize;
    }
    .closing { margin-top: 1.5rem; font-size: 0.875rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Authorization Successful!</h1>
    <p>You have successfully authorized with <span class="provider">${provider}</span></p>
    <p class="closing">This window will close automatically...</p>
  </div>
  <script>
    (function() {
      const message = {
        type: 'oauth-response',
        success: true,
        provider: '${provider}',
        sessionId: '${sessionId}',
        webcontainerId: ${webcontainerId ? `'${webcontainerId}'` : 'null'},
        tokens: {
          access_token: '${tokens.access_token}',
          token_type: '${tokens.token_type}',
          expires_in: ${tokens.expires_in || 'null'},
          scope: ${tokens.scope ? `'${tokens.scope}'` : 'null'}
        }
      };

      // Try posting to opener (popup flow)
      if (window.opener) {
        window.opener.postMessage(message, '*');
        setTimeout(() => window.close(), 2000);
      }
      // Try posting to parent (iframe flow)
      else if (window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
      // Broadcast to other tabs
      else if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('oauth-proxy');
        channel.postMessage(message);
        channel.close();
        setTimeout(() => window.close(), 2000);
      }
    })();
  </script>
</body>
</html>
  `.trim();

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

function renderErrorPage(error: string, description: string): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
    }
    h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
    p { color: #94a3b8; margin-bottom: 1rem; }
    .error-code { 
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(239, 68, 68, 0.2);
      border-radius: 9999px;
      font-size: 0.875rem;
      color: #fca5a5;
      font-family: monospace;
    }
    .description { margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem; }
    .close-btn {
      margin-top: 1.5rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 1rem;
    }
    .close-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Authorization Failed</h1>
    <p>Error: <span class="error-code">${error}</span></p>
    <div class="description">${description}</div>
    <button class="close-btn" onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      const message = {
        type: 'oauth-response',
        success: false,
        error: '${error}',
        errorDescription: '${description.replace(/'/g, "\\'")}'
      };

      if (window.opener) {
        window.opener.postMessage(message, '*');
      } else if (window.parent !== window) {
        window.parent.postMessage(message, '*');
      } else if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('oauth-proxy');
        channel.postMessage(message);
        channel.close();
      }
    })();
  </script>
</body>
</html>
  `.trim();

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
