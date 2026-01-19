/**
 * Project-Specific OAuth Callback Endpoint
 *
 * Handles OAuth callbacks for dynamically created Zoom Apps.
 * The projectId in the URL path is used to look up the stored credentials.
 *
 * Flow:
 * 1. Zoom Marketplace redirects to /api/oauth/proxy/callback/{projectId}?code=XXX
 * 2. We lookup the project's credentials from the store
 * 3. Exchange the code for tokens using those credentials
 * 4. Store the tokens for the project to retrieve
 * 5. Render a success page with instructions
 *
 * This endpoint enables the "Add" button in Zoom Marketplace to work
 * without requiring credentials in environment variables.
 */

import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getProjectCredentials, storeProjectTokens, getProjectRedirectUri } from '~/lib/services/project-store';

/**
 * Helper to get environment variables from context
 */
function getEnvVar(context: unknown, key: string): string {
  return (
    (context as { cloudflare?: { env?: Record<string, string> } })?.cloudflare?.env?.[key] || process.env[key] || ''
  );
}

/**
 * Exchange authorization code for tokens using project credentials
 */
async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}> {
  const tokenUrl = 'https://zoom.us/oauth/token';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  // Use Basic auth with client credentials
  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

  console.log('[ProjectCallback] Exchanging code for tokens');
  console.log('[ProjectCallback] Redirect URI:', redirectUri);

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
    console.error('[ProjectCallback] Token exchange failed:', errorText);
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };

  console.log('[ProjectCallback] Token exchange successful');

  return tokens;
}

/**
 * GET /api/oauth/proxy/callback/:projectId
 *
 * Handles the OAuth callback from Zoom with project-specific credentials
 */
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { projectId } = params;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  console.log(`[ProjectCallback] Received callback for project: ${projectId}`);

  // Handle OAuth errors from Zoom
  if (error) {
    console.error(`[ProjectCallback] OAuth error: ${error} - ${errorDescription}`);

    return renderErrorPage(error, errorDescription || 'Unknown error occurred');
  }

  // Validate code is present
  if (!code) {
    return renderErrorPage('invalid_request', 'Missing authorization code');
  }

  // Validate projectId is present
  if (!projectId) {
    return renderErrorPage('invalid_request', 'Missing project ID');
  }

  // Look up project credentials
  const credentials = await getProjectCredentials(projectId);

  if (!credentials) {
    console.error(`[ProjectCallback] Project not found or expired: ${projectId}`);

    return renderErrorPage(
      'project_not_found',
      `Project "${projectId}" not found or has expired. Please recreate the Zoom App.`,
    );
  }

  console.log(`[ProjectCallback] Found project: ${credentials.appName} (${credentials.appId})`);

  // Get the base URL for redirect URI
  const publicUrl = getEnvVar(context, 'VITE_PUBLIC_URL') || url.origin;
  const redirectUri = getProjectRedirectUri(projectId, publicUrl);

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(credentials.clientId, credentials.clientSecret, code, redirectUri);

    // Store tokens for the project to retrieve
    await storeProjectTokens(projectId, tokens);

    console.log(`[ProjectCallback] Successfully authorized project: ${projectId}`);

    // Render success page
    return renderSuccessPage(credentials.appName, projectId, tokens);
  } catch (err) {
    console.error('[ProjectCallback] Token exchange error:', err);

    const debugInfo = `
Token exchange failed. This could mean:

1. The authorization code has already been used
2. The authorization code has expired
3. The redirect URI doesn't match

Debug info:
- Project: ${credentials.appName}
- Client ID: ${credentials.clientId.substring(0, 8)}...
- Redirect URI: ${redirectUri}
- Error: ${err instanceof Error ? err.message : 'Unknown error'}

Try authorizing again through the Zoom Marketplace.
    `.trim();

    return renderErrorPage('token_exchange_failed', debugInfo);
  }
}

/**
 * Render success page with token info and instructions
 */
function renderSuccessPage(
  appName: string,
  projectId: string,
  tokens: {
    access_token: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  },
): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Successful - ${appName}</title>
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
      max-width: 500px;
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
    .app-name {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(16, 185, 129, 0.2);
      border-radius: 9999px;
      font-size: 0.875rem;
      color: #6ee7b7;
      margin-bottom: 1rem;
    }
    .info-box {
      background: rgba(255,255,255,0.05);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-top: 1.5rem;
      text-align: left;
    }
    .info-box h3 {
      font-size: 0.875rem;
      color: #e2e8f0;
      margin-bottom: 0.5rem;
    }
    .info-box p {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0;
    }
    .token-info {
      display: grid;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .token-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    .token-label { color: #64748b; }
    .token-value { color: #e2e8f0; font-family: monospace; }
    .instructions {
      margin-top: 1.5rem;
      padding: 1rem;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 0.5rem;
      border-left: 3px solid #3b82f6;
    }
    .instructions h3 {
      color: #93c5fd;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }
    .instructions p {
      font-size: 0.8rem;
      color: #94a3b8;
    }
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
    <div class="success-icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Authorization Successful!</h1>
    <div class="app-name">${appName}</div>
    <p>Your Zoom App has been authorized and is ready to use.</p>
    
    <div class="info-box">
      <h3>Token Information</h3>
      <div class="token-info">
        <div class="token-row">
          <span class="token-label">Type:</span>
          <span class="token-value">${tokens.token_type}</span>
        </div>
        <div class="token-row">
          <span class="token-label">Expires in:</span>
          <span class="token-value">${tokens.expires_in ? Math.floor(tokens.expires_in / 60) + ' minutes' : 'Unknown'}</span>
        </div>
        <div class="token-row">
          <span class="token-label">Scopes:</span>
          <span class="token-value">${tokens.scope || 'N/A'}</span>
        </div>
      </div>
    </div>
    
    <div class="instructions">
      <h3>Next Steps</h3>
      <p>Return to your app to continue. The tokens will be automatically retrieved by your application.</p>
    </div>
    
    <button class="close-btn" onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      // Post message to parent/opener if available (for popup flow)
      const message = {
        type: 'oauth-response',
        success: true,
        provider: 'zoom',
        projectId: '${projectId}',
        appName: '${appName}',
        // Note: tokens are stored server-side and retrieved separately
        tokenStored: true
      };

      if (window.opener) {
        window.opener.postMessage(message, '*');
        // Don't auto-close - let user see the success message
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

/**
 * Render error page with helpful information
 */
function renderErrorPage(error: string, description: string): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Failed</title>
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
      max-width: 500px;
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
    .description {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0,0,0,0.2);
      border-radius: 0.5rem;
      text-align: left;
      font-size: 0.875rem;
      white-space: pre-wrap;
      font-family: monospace;
      color: #f1f5f9;
    }
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
        errorDescription: '${description.replace(/'/g, "\\'").replace(/\n/g, '\\n')}'
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
