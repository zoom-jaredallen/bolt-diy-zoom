/**
 * OAuth Proxy Service
 *
 * Provides OAuth proxy functionality for apps running in WebContainer.
 * Since WebContainer apps have ephemeral URLs (*.webcontainer-api.io),
 * this service allows OAuth flows to use a stable redirect URL.
 */

export interface OAuthProviderConfig {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

export interface OAuthSession {
  id: string;
  provider: string;
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  scopes: string[];
  webcontainerId?: string;
  createdAt: number;
  expiresAt: number;

  // Dynamic credentials for newly created apps
  dynamicCredentials?: {
    clientId: string;
    clientSecret: string;
    appId?: string;
    appName?: string;
  };
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

// In-memory session storage (consider Redis for production multi-instance)

const oauthSessions = new Map<string, OAuthSession>();
const oauthTokens = new Map<string, OAuthTokens>();

// Session TTL: 10 minutes
const SESSION_TTL = 10 * 60 * 1000;

// Token TTL: 1 hour (should be refreshed before expiry)
const TOKEN_TTL = 60 * 60 * 1000;

/**
 * Ensure URL uses HTTPS protocol
 * Zoom and most OAuth providers require HTTPS for redirect URIs
 */
function ensureHttps(url: string): string {
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    // Allow localhost for local development
    return url;
  }

  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * Get OAuth provider configuration from environment variables
 */
export function getOAuthProviderConfig(provider: string, env: Record<string, string>): OAuthProviderConfig | null {
  switch (provider.toLowerCase()) {
    case 'zoom':
      return {
        name: 'zoom',
        authorizationUrl: 'https://zoom.us/oauth/authorize',
        tokenUrl: 'https://zoom.us/oauth/token',
        clientId: env.ZOOM_OAUTH_CLIENT_ID || env.ZOOM_CLIENT_ID || '',
        clientSecret: env.ZOOM_OAUTH_CLIENT_SECRET || env.ZOOM_CLIENT_SECRET || '',
        scopes: ['meeting:read', 'meeting:write', 'user:read'],
      };

    case 'github':
      return {
        name: 'github',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        clientId: env.GITHUB_OAUTH_CLIENT_ID || '',
        clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET || '',
        scopes: ['repo', 'user'],
      };

    case 'gitlab':
      return {
        name: 'gitlab',
        authorizationUrl: `${env.VITE_GITLAB_URL || 'https://gitlab.com'}/oauth/authorize`,
        tokenUrl: `${env.VITE_GITLAB_URL || 'https://gitlab.com'}/oauth/token`,
        clientId: env.GITLAB_OAUTH_CLIENT_ID || '',
        clientSecret: env.GITLAB_OAUTH_CLIENT_SECRET || '',
        scopes: ['api', 'read_user', 'read_repository', 'write_repository'],
      };

    case 'google':
      return {
        name: 'google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: env.GOOGLE_OAUTH_CLIENT_ID || '',
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        scopes: ['openid', 'email', 'profile'],
        additionalParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      };

    default:
      return null;
  }
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateSecureString(32);
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Create a new OAuth session
 */
export async function createOAuthSession(
  provider: string,
  scopes: string[],
  redirectUri: string,
  webcontainerId?: string,
): Promise<OAuthSession> {
  const sessionId = generateSecureString(16);
  const state = generateSecureString(16);
  const { codeVerifier } = await generatePKCE();

  const session: OAuthSession = {
    id: sessionId,
    provider,
    state,
    codeVerifier,
    redirectUri,
    scopes,
    webcontainerId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };

  oauthSessions.set(sessionId, session);

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  return session;
}

/**
 * Get OAuth session by state
 */
export function getOAuthSessionByState(state: string): OAuthSession | null {
  for (const session of oauthSessions.values()) {
    if (session.state === state && session.expiresAt > Date.now()) {
      return session;
    }
  }

  return null;
}

/**
 * Get OAuth session by ID
 */
export function getOAuthSession(sessionId: string): OAuthSession | null {
  const session = oauthSessions.get(sessionId);

  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  return null;
}

/**
 * Delete OAuth session
 */
export function deleteOAuthSession(sessionId: string): void {
  oauthSessions.delete(sessionId);
}

/**
 * Store OAuth tokens
 */
export function storeOAuthTokens(sessionId: string, tokens: OAuthTokens): void {
  oauthTokens.set(sessionId, tokens);

  // Set expiry for token cleanup
  setTimeout(
    () => {
      oauthTokens.delete(sessionId);
    },
    tokens.expires_in ? tokens.expires_in * 1000 : TOKEN_TTL,
  );
}

/**
 * Get OAuth tokens
 */
export function getOAuthTokens(sessionId: string): OAuthTokens | null {
  return oauthTokens.get(sessionId) || null;
}

/**
 * Build authorization URL
 */
export function buildAuthorizationUrl(config: OAuthProviderConfig, session: OAuthSession, publicUrl: string): string {
  const secureUrl = ensureHttps(publicUrl);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${secureUrl}/api/oauth/proxy/callback`,
    response_type: 'code',
    state: session.state,
    scope: session.scopes.join(' '),
    ...config.additionalParams,
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string,
  publicUrl: string,
): Promise<OAuthTokens> {
  const secureUrl = ensureHttps(publicUrl);
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${secureUrl}/api/oauth/proxy/callback`,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();

  for (const [id, session] of oauthSessions.entries()) {
    if (session.expiresAt < now) {
      oauthSessions.delete(id);
    }
  }
}

/**
 * Get supported OAuth providers
 */
export function getSupportedProviders(): string[] {
  return ['zoom', 'github', 'gitlab', 'google'];
}

/**
 * Create an OAuth session with dynamic credentials (for newly created apps)
 */
export async function createDynamicOAuthSession(
  provider: string,
  scopes: string[],
  publicUrl: string,
  dynamicCredentials: {
    clientId: string;
    clientSecret: string;
    appId?: string;
    appName?: string;
  },
  webcontainerId?: string,
): Promise<OAuthSession> {
  const sessionId = generateSecureString(16);
  const state = generateSecureString(16);
  const { codeVerifier } = await generatePKCE();

  const session: OAuthSession = {
    id: sessionId,
    provider,
    state,
    codeVerifier,
    redirectUri: publicUrl,
    scopes,
    webcontainerId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
    dynamicCredentials,
  };

  oauthSessions.set(sessionId, session);

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  console.log(
    `[OAuth] Created dynamic session for ${provider} app: ${dynamicCredentials.appName || dynamicCredentials.appId}`,
  );

  return session;
}

/**
 * Build authorization URL with dynamic credentials
 */
export function buildDynamicAuthorizationUrl(session: OAuthSession, publicUrl: string): string {
  if (!session.dynamicCredentials) {
    throw new Error('Session does not have dynamic credentials');
  }

  const secureUrl = ensureHttps(publicUrl);
  const params = new URLSearchParams({
    client_id: session.dynamicCredentials.clientId,
    redirect_uri: `${secureUrl}/api/oauth/proxy/callback`,
    response_type: 'code',
    state: session.state,
    scope: session.scopes.join(' '),
  });

  // Determine authorization URL based on provider
  let authorizationUrl = 'https://zoom.us/oauth/authorize';

  if (session.provider === 'github') {
    authorizationUrl = 'https://github.com/login/oauth/authorize';
  } else if (session.provider === 'gitlab') {
    authorizationUrl = 'https://gitlab.com/oauth/authorize';
  } else if (session.provider === 'google') {
    authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');
  }

  return `${authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens using dynamic credentials
 */
export async function exchangeCodeForTokensWithDynamicCredentials(
  session: OAuthSession,
  code: string,
  publicUrl: string,
): Promise<OAuthTokens> {
  if (!session.dynamicCredentials) {
    throw new Error('Session does not have dynamic credentials');
  }

  const secureUrl = ensureHttps(publicUrl);

  // Determine token URL based on provider
  let tokenUrl = 'https://zoom.us/oauth/token';

  if (session.provider === 'github') {
    tokenUrl = 'https://github.com/login/oauth/access_token';
  } else if (session.provider === 'gitlab') {
    tokenUrl = 'https://gitlab.com/oauth/token';
  } else if (session.provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${secureUrl}/api/oauth/proxy/callback`,
    client_id: session.dynamicCredentials.clientId,
    client_secret: session.dynamicCredentials.clientSecret,
  });

  console.log(`[OAuth] Exchanging code for tokens with dynamic credentials for ${session.provider}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[OAuth] Token exchange failed for ${session.provider}:`, error);
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = (await response.json()) as OAuthTokens;
  console.log(`[OAuth] Token exchange successful for ${session.provider}`);

  return tokens;
}
