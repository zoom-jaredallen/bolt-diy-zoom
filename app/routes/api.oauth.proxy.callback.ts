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
  storeOAuthTokens,
  deleteOAuthSession,
} from '~/lib/services/oauth-proxy';

function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
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

  // Validate required parameters
  if (!code || !state) {
    return renderErrorPage('invalid_request', 'Missing code or state parameter');
  }

  // Find session by state
  const session = getOAuthSessionByState(state);

  if (!session) {
    return renderErrorPage('invalid_state', 'OAuth session expired or invalid. Please try again.');
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
  const config = getOAuthProviderConfig(session.provider, env);

  if (!config) {
    return renderErrorPage('invalid_provider', `Unknown provider: ${session.provider}`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(config, code, session.redirectUri);

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
