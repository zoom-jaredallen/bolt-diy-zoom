/**
 * Zoom Marketplace API Service
 *
 * Handles Server-to-Server OAuth authentication and Marketplace API interactions
 * for automated Zoom App creation.
 *
 * Documentation:
 * - Using Zoom APIs: https://developers.zoom.us/docs/api/using-zoom-apis/
 * - Marketplace API: https://developers.zoom.us/docs/api/marketplace/
 * - Manifest Schema: https://developers.zoom.us/docs/build-flow/manifests/schema/
 */

/**
 * Environment variables interface
 */
export interface ZoomCredentials {
  clientId: string;
  clientSecret: string;
  accountId: string;
}

/**
 * S2S OAuth token response
 */
interface ZoomAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Scope object for oauth_information.scopes
 */
interface ZoomScopeObject {
  scope: string;
  optional: boolean;
}

/**
 * Zoom App creation request body (correct schema as of 2024+)
 */
export interface ZoomAppCreateRequest {
  app_name: string;
  app_type: 'general' | 's2s_oauth' | 'chatbot' | 'team_chat';
  company_name: string;
  contact_email: string;
  contact_name: string;
  scopes: string[];
  active: boolean;
  publish: boolean;
  manifest: ZoomAppManifest;
}

/**
 * Zoom App manifest structure
 */
export interface ZoomAppManifest {
  display_information: {
    display_name: string;
    description: string;
    long_description: string;
  };
  oauth_information: {
    usage: 'USER_OPERATION' | 'ADMIN_OPERATION';
    development_redirect_uri: string;
    production_redirect_uri: string;
    oauth_allow_list: string[];
    strict_mode: boolean;
    subdomain_strict_mode: boolean;
    scopes: ZoomScopeObject[];
    scope_description: string;
  };
  features: {
    products: ZoomProduct[];
    development_home_uri: string;
    production_home_uri: string;
    in_client_feature: {
      zoom_app_api: {
        enable: boolean;
        zoom_app_apis: string[];
      };
      guest_mode: {
        enable: boolean;
        enable_test_guest_mode: boolean;
      };
      in_client_oauth: {
        enable: boolean;
      };
      collaborate_mode: {
        enable: boolean;
        enable_screen_sharing: boolean;
        enable_play_together: boolean;
        enable_start_immediately: boolean;
        enable_join_immediately: boolean;
      };
    };
  };
}

/**
 * Zoom product type (uppercase format)
 */
type ZoomProduct = 'ZOOM_MEETING' | 'ZOOM_PHONE' | 'ZOOM_CONTACT_CENTER' | 'ZOOM_WEBINAR' | 'ZOOM_TEAM_CHAT';

/**
 * Zoom App creation response
 */
export interface ZoomAppCreateResponse {
  app_id: string;
  oauth_authorize_url: string;
  credentials: {
    client_id: string;
    client_secret: string;
  };
}

/**
 * Error response from Zoom API
 */
export interface ZoomApiError {
  code?: number;
  message?: string;
  ok?: boolean;
  error?: string;
  errors?: Array<{
    setting?: string;
    message?: string;
  }>;
}

/**
 * Token cache to avoid excessive OAuth calls
 */
interface TokenCache {
  token: string;
  expiresAt: number;
}

// In-memory token cache (1 hour TTL)
let tokenCache: TokenCache | null = null;

import { generateProjectId, storeProjectCredentials, getProjectRedirectUri } from '~/lib/services/project-store';

/**
 * Default values for Zoom App creation
 */
export const ZOOM_APP_DEFAULTS = {
  contact_name: 'Jared Allen',
  contact_email: 'jared.allen@zoom.us',
  company_name: 'Zoom',
  base_url: 'https://zoomvibes.j4red4llen.com',
  oauth_callback_url: 'https://zoomvibes.j4red4llen.com/api/oauth/proxy/callback',
  webcontainer_preview_base: 'https://zoomvibes.j4red4llen.com/webcontainer/preview',

  /*
   * Default scopes for General Apps (in-client Zoom Apps)
   * - meeting:read:meeting - Read meeting information
   * - zoomapp:inmeeting - Required for in-client features
   */
  default_scopes: ['meeting:read:meeting', 'zoomapp:inmeeting'],

  /*
   * Default Zoom App APIs to enable
   */
  default_zoom_app_apis: ['getPhoneContext', 'getRunningContext', 'getSupportedJsApis', 'openUrl'],

  /*
   * Default products to enable
   */
  default_products: ['ZOOM_MEETING', 'ZOOM_PHONE', 'ZOOM_CONTACT_CENTER'] as ZoomProduct[],
};

/**
 * Get Server-to-Server OAuth access token
 *
 * Uses account credentials flow to obtain access token for Marketplace API calls.
 * Implements caching to reduce API calls (tokens valid for 1 hour).
 *
 * @param credentials - Zoom S2S OAuth credentials
 * @returns Access token string
 */
export async function getZoomAccessToken(credentials: ZoomCredentials): Promise<string> {
  // Check cache first
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    console.log('[ZoomAPI] Using cached access token');
    return tokenCache.token;
  }

  console.log('[ZoomAPI] Fetching new access token via S2S OAuth');

  const { clientId, clientSecret, accountId } = credentials;

  // Validate credentials
  if (!clientId || !clientSecret || !accountId) {
    throw new ZoomMarketplaceError(
      'Missing Zoom credentials. Ensure ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID are set.',
      'MISSING_CREDENTIALS',
    );
  }

  // Build authorization header (Basic auth with client credentials)
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { reason?: string };

      throw new ZoomMarketplaceError(
        `OAuth token request failed: ${errorData.reason || response.statusText}`,
        'OAUTH_FAILED',
        response.status,
      );
    }

    const data = (await response.json()) as ZoomAccessTokenResponse;

    // Cache the token (with 5 minute buffer before expiry)
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    console.log('[ZoomAPI] Access token obtained successfully');

    return data.access_token;
  } catch (error) {
    if (error instanceof ZoomMarketplaceError) {
      throw error;
    }

    throw new ZoomMarketplaceError(
      `Failed to obtain access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'OAUTH_FAILED',
    );
  }
}

/**
 * Create a Zoom App via Marketplace API
 *
 * @param credentials - Zoom S2S OAuth credentials
 * @param request - App creation request with manifest
 * @returns Created app details including credentials
 */
export async function createZoomApp(
  credentials: ZoomCredentials,
  request: ZoomAppCreateRequest,
): Promise<ZoomAppCreateResponse> {
  const accessToken = await getZoomAccessToken(credentials);

  console.log('[ZoomAPI] Creating Zoom App:', request.app_name);
  console.log('[ZoomAPI] Request body:', JSON.stringify(request, null, 2));

  try {
    const response = await fetch('https://api.zoom.us/v2/marketplace/apps', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as ZoomApiError;

      // Build detailed error message
      let errorMessage = errorData.message || errorData.error || response.statusText;

      if (errorData.errors && errorData.errors.length > 0) {
        const details = errorData.errors.map((e) => `${e.setting}: ${e.message}`).join('; ');
        errorMessage = `${errorMessage} - Details: ${details}`;
      }

      console.error('[ZoomAPI] App creation failed:', {
        status: response.status,
        error: errorData.error,
        errors: errorData.errors,
        message: errorMessage,
      });

      throw new ZoomMarketplaceError(`App creation failed: ${errorMessage}`, 'APP_CREATION_FAILED', response.status);
    }

    const data = (await response.json()) as ZoomAppCreateResponse;
    console.log('[ZoomAPI] Zoom App created successfully:', data.app_id);
    console.log('[ZoomAPI] OAuth Authorize URL:', data.oauth_authorize_url);

    return data;
  } catch (error) {
    if (error instanceof ZoomMarketplaceError) {
      throw error;
    }

    throw new ZoomMarketplaceError(
      `Failed to create Zoom App: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'APP_CREATION_FAILED',
    );
  }
}

/**
 * Create a Zoom App with retry logic
 *
 * Implements exponential backoff for transient failures.
 *
 * @param credentials - Zoom S2S OAuth credentials
 * @param request - App creation request
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Created app details
 */
export async function createZoomAppWithRetry(
  credentials: ZoomCredentials,
  request: ZoomAppCreateRequest,
  maxRetries: number = 3,
): Promise<ZoomAppCreateResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ZoomAPI] Attempt ${attempt}/${maxRetries} to create Zoom App`);

      const result = await createZoomApp(credentials, request);

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors (4xx except rate limits)
      if (error instanceof ZoomMarketplaceError) {
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          console.log('[ZoomAPI] Non-retryable error, failing immediately');
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[ZoomAPI] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new ZoomMarketplaceError(
    `Failed to create Zoom App after ${maxRetries} attempts: ${lastError?.message}`,
    'MAX_RETRIES_EXCEEDED',
  );
}

/**
 * Build a Zoom App manifest with sensible defaults
 *
 * @param options - Manifest configuration options
 * @returns Complete manifest for API request
 */
export function buildZoomAppManifest(options: {
  appName: string;
  description?: string;
  longDescription?: string;
  scopes?: string[];
  previewId?: string;
  products?: ZoomProduct[];
  zoomAppApis?: string[];
  projectId?: string; // Optional: for project-specific redirect URI
}): ZoomAppManifest {
  const {
    appName,
    description = `${appName} - Built with Zoom App Builder`,
    longDescription = 'A Zoom App created using Zoom App Builder - the AI-powered web development environment.',
    scopes = ZOOM_APP_DEFAULTS.default_scopes,
    previewId,
    products = ZOOM_APP_DEFAULTS.default_products,
    zoomAppApis = ZOOM_APP_DEFAULTS.default_zoom_app_apis,
    projectId,
  } = options;

  // Build home URI using the WebContainer preview URL if previewId provided
  const homeUri = previewId
    ? `${ZOOM_APP_DEFAULTS.webcontainer_preview_base}/${previewId}`
    : ZOOM_APP_DEFAULTS.webcontainer_preview_base;

  // Convert string scopes to scope objects
  const scopeObjects: ZoomScopeObject[] = scopes.map((scope) => ({
    scope,
    optional: false,
  }));

  // Use project-specific redirect URI if projectId is provided
  const redirectUri = projectId
    ? getProjectRedirectUri(projectId, ZOOM_APP_DEFAULTS.base_url)
    : ZOOM_APP_DEFAULTS.oauth_callback_url;

  return {
    display_information: {
      display_name: appName,
      description: description.slice(0, 100), // 100 char limit for description
      long_description: longDescription.slice(0, 4000), // 4000 char limit
    },
    oauth_information: {
      usage: 'USER_OPERATION',
      development_redirect_uri: redirectUri,
      production_redirect_uri: redirectUri,
      oauth_allow_list: [ZOOM_APP_DEFAULTS.base_url],
      strict_mode: false,
      subdomain_strict_mode: true,
      scopes: scopeObjects,
      scope_description: `Scopes for ${appName}`,
    },
    features: {
      products,
      development_home_uri: homeUri,
      production_home_uri: homeUri,
      in_client_feature: {
        zoom_app_api: {
          enable: true,
          zoom_app_apis: zoomAppApis,
        },
        guest_mode: {
          enable: false,
          enable_test_guest_mode: false,
        },
        in_client_oauth: {
          enable: false,
        },
        collaborate_mode: {
          enable: false,
          enable_screen_sharing: false,
          enable_play_together: false,
          enable_start_immediately: false,
          enable_join_immediately: false,
        },
      },
    },
  };
}

/**
 * Build complete app creation request
 *
 * @param options - Options for request generation
 * @returns Complete request body for Marketplace API
 */
export function buildZoomAppCreateRequest(options: {
  appName: string;
  description?: string;
  longDescription?: string;
  scopes?: string[];
  previewId?: string;
  products?: ZoomProduct[];
  zoomAppApis?: string[];
  projectId?: string; // Optional: for project-specific redirect URI
}): ZoomAppCreateRequest {
  const scopes = options.scopes || ZOOM_APP_DEFAULTS.default_scopes;

  return {
    app_name: options.appName,
    app_type: 'general',
    company_name: ZOOM_APP_DEFAULTS.company_name,
    contact_email: ZOOM_APP_DEFAULTS.contact_email,
    contact_name: ZOOM_APP_DEFAULTS.contact_name,
    scopes, // Top-level scopes as string array
    active: false,
    publish: false,
    manifest: buildZoomAppManifest(options),
  };
}

/**
 * Extended response with project information
 */
export interface ZoomAppCreateWithProjectResponse extends ZoomAppCreateResponse {
  projectId: string;
  redirectUri: string;
  tokenPollingUrl: string;
}

/**
 * Create a Zoom App with automatic project registration
 *
 * This function:
 * 1. Generates a unique project ID
 * 2. Creates the Zoom App with project-specific redirect URI
 * 3. Stores the credentials in the project store
 * 4. Returns extended response with project details
 *
 * This enables the Marketplace "Add" button to work automatically
 * without requiring credentials in environment variables.
 *
 * @param credentials - Zoom S2S OAuth credentials
 * @param options - App creation options
 * @returns Created app details with project information
 */
export async function createZoomAppWithProject(
  credentials: ZoomCredentials,
  options: {
    appName: string;
    description?: string;
    longDescription?: string;
    scopes?: string[];
    previewId?: string;
  },
): Promise<ZoomAppCreateWithProjectResponse> {
  // Generate a unique project ID
  const projectId = generateProjectId();

  console.log(`[ZoomAPI] Creating Zoom App with project: ${projectId}`);

  // Build request with project-specific redirect URI
  const request = buildZoomAppCreateRequest({
    ...options,
    projectId,
  });

  // Create the app with retry logic
  const result = await createZoomAppWithRetry(credentials, request);

  // Store credentials in project store
  await storeProjectCredentials({
    projectId,
    clientId: result.credentials.client_id,
    clientSecret: result.credentials.client_secret,
    appId: result.app_id,
    appName: options.appName,
  });

  // Get the redirect URI for reference
  const redirectUri = getProjectRedirectUri(projectId, ZOOM_APP_DEFAULTS.base_url);

  // Build the token polling URL
  const tokenPollingUrl = `${ZOOM_APP_DEFAULTS.base_url}/api/oauth/tokens/${projectId}`;

  console.log(`[ZoomAPI] App created with project: ${projectId}`);
  console.log(`[ZoomAPI] Redirect URI: ${redirectUri}`);
  console.log(`[ZoomAPI] Token Polling URL: ${tokenPollingUrl}`);

  return {
    ...result,
    projectId,
    redirectUri,
    tokenPollingUrl,
  };
}

/**
 * Generate .env file content with project-based credentials
 *
 * This version includes the projectId and token polling URL
 * for automatic OAuth token retrieval.
 *
 * @param response - API response with credentials and project info
 * @param appName - Name of the created app
 * @returns String content for .env file
 */
export function generateEnvFileContentWithProject(response: ZoomAppCreateWithProjectResponse, appName: string): string {
  console.log('[generateEnvFileContent] Generating .env content for app with project:', appName);

  const content = `# ======================================
# Zoom App Credentials
# Auto-generated by Bolt.diy on ${new Date().toISOString()}
# ======================================

# App Information
ZOOM_APP_ID=${response.app_id}
ZOOM_APP_NAME=${appName}

# Project Information (for OAuth flow)
# The projectId is used to retrieve OAuth tokens after Marketplace authorization
ZOOM_PROJECT_ID=${response.projectId}

# Zoom App OAuth Credentials (Client ID is public, needed for client-side)
VITE_ZOOM_CLIENT_ID=${response.credentials.client_id}

# NOTE: Client secret is stored securely on the bolt.diy server
# It is NOT included in this file for security reasons!
# The OAuth flow is handled via the redirect URI below.

# OAuth Configuration
# This redirect URI is automatically handled by bolt.diy
VITE_OAUTH_REDIRECT_URL=${response.redirectUri}

# Token Polling URL
# After OAuth authorization, poll this URL to retrieve tokens
ZOOM_TOKEN_POLLING_URL=${response.tokenPollingUrl}

# Zoom Marketplace
# Manage your app at: https://marketplace.zoom.us/develop/apps/${response.app_id}
# 
# To authorize (Local Test):
# 1. Go to the Marketplace link above
# 2. Click "Local Test" tab
# 3. Click "Add" to authorize the app
# 4. Your app will automatically receive the OAuth tokens
`;

  console.log('[generateEnvFileContent] Generated content length:', content.length);

  return content;
}

/**
 * Generate a proper OAuth authorization URL that goes through the dynamic proxy
 *
 * @param credentials - The app credentials
 * @param appId - The app ID
 * @param appName - The app name
 * @param scopes - The scopes to request
 * @returns A URL that can be used to start the OAuth flow
 */
export function generateProxyOAuthUrl(
  credentials: { client_id: string; client_secret: string },
  appId: string,
  appName: string,
  scopes: string[] = ZOOM_APP_DEFAULTS.default_scopes,
): string {
  /*
   * Build a URL that will go through our dynamic OAuth proxy.
   * The proxy will create a session with the state parameter.
   */
  const params = new URLSearchParams({
    provider: 'zoom',
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
    appId,
    appName,
    scopes: scopes.join(','),
  });

  return `${ZOOM_APP_DEFAULTS.base_url}/api/oauth/proxy/dynamic?${params.toString()}`;
}

/**
 * Generate .env file content with Zoom App credentials
 *
 * @param response - API response with credentials
 * @param appName - Name of the created app
 * @returns String content for .env file
 */
export function generateEnvFileContent(response: ZoomAppCreateResponse, appName: string): string {
  console.log('[generateEnvFileContent] Generating .env content for app:', appName);
  console.log('[generateEnvFileContent] App ID:', response.app_id);
  console.log('[generateEnvFileContent] Has credentials:', !!response.credentials);

  // Generate a proper OAuth URL that goes through our proxy
  const proxyOAuthUrl = generateProxyOAuthUrl(response.credentials, response.app_id, appName);

  const content = `# ======================================
# Zoom App Credentials
# Auto-generated by Bolt.diy on ${new Date().toISOString()}
# ======================================

# App Information
ZOOM_APP_ID=${response.app_id}
ZOOM_APP_NAME=${appName}

# Zoom App OAuth Credentials
VITE_ZOOM_CLIENT_ID=${response.credentials.client_id}
ZOOM_CLIENT_SECRET=${response.credentials.client_secret}

# OAuth Configuration
VITE_OAUTH_REDIRECT_URL=${ZOOM_APP_DEFAULTS.oauth_callback_url}

# OAuth Authorization URL (use this to authorize the app)
# This URL goes through our OAuth proxy to properly handle state parameter
ZOOM_OAUTH_AUTHORIZE_URL=${proxyOAuthUrl}

# Direct Zoom OAuth URL (for reference only - DO NOT use directly)
# ${response.oauth_authorize_url}

# Zoom Marketplace
# Manage your app at: https://marketplace.zoom.us/develop/apps/${response.app_id}
`;

  console.log('[generateEnvFileContent] Generated content length:', content.length);

  return content;
}

/**
 * Clear the token cache (useful for testing or credential rotation)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  console.log('[ZoomAPI] Token cache cleared');
}

/**
 * Custom error class for Zoom Marketplace operations
 */
export class ZoomMarketplaceError extends Error {
  readonly code: string;
  readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'ZoomMarketplaceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
