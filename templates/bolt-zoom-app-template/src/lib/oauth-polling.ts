/**
 * OAuth Token Polling Utility
 *
 * This module provides functionality to poll for OAuth tokens after
 * authorization via Zoom Marketplace's Local Test flow.
 *
 * When a user clicks "Add" in Zoom Marketplace, the OAuth flow is handled
 * by bolt.diy's server. This utility polls the token endpoint to retrieve
 * the tokens once authorization is complete.
 *
 * Usage:
 * ```typescript
 * import { pollForTokens, checkTokenStatus } from './lib/oauth-polling';
 *
 * // Poll for tokens (will retry until tokens are available or timeout)
 * const tokens = await pollForTokens();
 *
 * // Or check status without blocking
 * const status = await checkTokenStatus();
 * if (status.success && status.tokens) {
 *   // Use tokens
 * }
 * ```
 */

/**
 * OAuth tokens returned after successful authorization
 */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Token polling response
 */
export interface TokenPollingResponse {
  success: boolean;
  tokens?: OAuthTokens;
  pending?: boolean;
  message?: string;
  error?: string;
  project?: {
    projectId: string;
    appId: string;
    appName: string;
  };
}

/**
 * Polling options
 */
export interface PollingOptions {
  /** Maximum time to poll in milliseconds (default: 5 minutes) */
  timeout?: number;

  /** Interval between polling attempts in milliseconds (default: 2 seconds) */
  interval?: number;

  /** Callback for status updates */
  onStatusUpdate?: (status: TokenPollingResponse) => void;
}

/**
 * Get the project ID from environment variables
 */
function getProjectId(): string | undefined {
  return import.meta.env.ZOOM_PROJECT_ID || import.meta.env.VITE_ZOOM_PROJECT_ID;
}

/**
 * Get the token polling URL
 */
function getTokenPollingUrl(): string {
  const baseUrl = import.meta.env.ZOOM_TOKEN_POLLING_URL;

  if (baseUrl) {
    return baseUrl;
  }

  // Construct from project ID if URL not explicitly set
  const projectId = getProjectId();

  if (!projectId) {
    throw new Error(
      'Missing project configuration. Ensure ZOOM_PROJECT_ID or ZOOM_TOKEN_POLLING_URL is set in your .env file.',
    );
  }

  // Default bolt.diy URL
  return `https://zoomvibes.j4red4llen.com/api/oauth/tokens/${projectId}`;
}

/**
 * Check the current status of OAuth tokens
 *
 * This is a one-time check that returns immediately.
 * If tokens are available, they are returned and cleared from the server.
 *
 * @returns Token polling response
 */
export async function checkTokenStatus(): Promise<TokenPollingResponse> {
  const url = getTokenPollingUrl();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Project not found or expired',
          message: 'The project may have expired. Please recreate the Zoom App.',
        };
      }

      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as TokenPollingResponse;

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check token status',
    };
  }
}

/**
 * Poll for OAuth tokens
 *
 * This function will continuously poll the token endpoint until:
 * - Tokens are available and returned
 * - Timeout is reached
 * - An error occurs
 *
 * @param options - Polling options
 * @returns OAuth tokens or throws an error
 */
export async function pollForTokens(options: PollingOptions = {}): Promise<OAuthTokens> {
  const { timeout = 5 * 60 * 1000, interval = 2000, onStatusUpdate } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await checkTokenStatus();

    // Call status update callback if provided
    if (onStatusUpdate) {
      onStatusUpdate(status);
    }

    // Tokens received!
    if (status.success && status.tokens) {
      return status.tokens;
    }

    // Error occurred
    if (status.error && !status.pending) {
      throw new Error(status.error);
    }

    // Still pending, wait and retry
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for OAuth authorization. Please try authorizing again.');
}

/**
 * Store tokens in localStorage
 *
 * @param tokens - OAuth tokens to store
 */
export function storeTokens(tokens: OAuthTokens): void {
  localStorage.setItem('zoom_tokens', JSON.stringify(tokens));

  // Also store expiration time if available
  if (tokens.expires_in) {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem('zoom_tokens_expires_at', expiresAt.toString());
  }
}

/**
 * Get stored tokens from localStorage
 *
 * @returns Stored tokens or null if not found/expired
 */
export function getStoredTokens(): OAuthTokens | null {
  const tokensJson = localStorage.getItem('zoom_tokens');

  if (!tokensJson) {
    return null;
  }

  // Check expiration
  const expiresAtStr = localStorage.getItem('zoom_tokens_expires_at');

  if (expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() > expiresAt) {
      // Tokens expired, clear storage
      clearStoredTokens();

      return null;
    }
  }

  try {
    return JSON.parse(tokensJson) as OAuthTokens;
  } catch {
    return null;
  }
}

/**
 * Clear stored tokens from localStorage
 */
export function clearStoredTokens(): void {
  localStorage.removeItem('zoom_tokens');
  localStorage.removeItem('zoom_tokens_expires_at');
}

/**
 * Check if user is authorized (has valid tokens)
 *
 * @returns True if valid tokens exist
 */
export function isAuthorized(): boolean {
  return getStoredTokens() !== null;
}

/**
 * Get the access token for API calls
 *
 * @returns Access token or null if not authorized
 */
export function getAccessToken(): string | null {
  const tokens = getStoredTokens();

  return tokens?.access_token ?? null;
}

/**
 * Initialize OAuth by polling for tokens if not already authorized
 *
 * This is a convenience function that:
 * 1. Checks if tokens already exist in localStorage
 * 2. If not, starts polling for tokens
 * 3. Stores received tokens in localStorage
 *
 * @param options - Polling options
 * @returns OAuth tokens
 */
export async function initializeOAuth(options: PollingOptions = {}): Promise<OAuthTokens> {
  // Check for existing tokens
  const existingTokens = getStoredTokens();

  if (existingTokens) {
    console.log('[OAuth] Using existing tokens from localStorage');

    return existingTokens;
  }

  console.log('[OAuth] No existing tokens, polling for new tokens...');

  // Poll for new tokens
  const tokens = await pollForTokens(options);

  // Store tokens
  storeTokens(tokens);

  console.log('[OAuth] Tokens received and stored');

  return tokens;
}
