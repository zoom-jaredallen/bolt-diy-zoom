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
 * Zoom App creation request body
 */
export interface ZoomAppCreateRequest {
  app_type: 'general' | 's2s_oauth' | 'chatbot' | 'team_chat';
  contact_name: string;
  contact_email: string;
  company_name: string;
  active: boolean;
  manifest?: ZoomAppManifest;
}

/**
 * Zoom App manifest structure (new unified build flow)
 */
export interface ZoomAppManifest {
  display_information: {
    name: string;
    short_description?: string;
    long_description?: string;
    support_url?: string;
    privacy_policy_url?: string;
    terms_of_use_url?: string;
  };
  oauth_information?: {
    redirect_uri?: string;
    scopes?: string[];
  };
  features?: {
    products?: ZoomProduct[];
    development_home_uri?: string;
    production_home_uri?: string;
    domain_allow_list?: string[];
    in_client_feature?: {
      collaborate?: boolean;
      main_panel?: boolean;
      camera?: boolean;
      custom_background?: boolean;
    };
    zoom_client_support?: {
      windows?: boolean;
      mac?: boolean;
      linux?: boolean;
      ios?: boolean;
      android?: boolean;
    };
    embed?: {
      enabled?: boolean;
      meeting?: boolean;
      webinar?: boolean;
    };
    team_chat_subscription?: {
      enabled?: boolean;
      event_types?: string[];
    };
    event_subscription?: {
      enabled?: boolean;
      endpoint_url?: string;
      event_types?: string[];
    };
  };
}

/**
 * Zoom product type
 */
type ZoomProduct = 'meetings' | 'webinars' | 'team_chat' | 'zoom_rooms' | 'contact_center';

/**
 * Zoom App creation response
 */
export interface ZoomAppCreateResponse {
  created_at: string;
  app_id: string;
  app_name: string;
  app_type: string;
  scopes: string[];
  production_credentials: {
    client_id: string;
    client_secret: string;
  };
  development_credentials: {
    client_id: string;
    client_secret: string;
  };
}

/**
 * Error response from Zoom API
 */
export interface ZoomApiError {
  code: number;
  message: string;
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

/**
 * Default values for Zoom App creation
 */
export const ZOOM_APP_DEFAULTS = {
  contact_name: 'Jared Allen',
  contact_email: 'jared.allen@zoom.us',
  company_name: 'Zoom',
  domain_allow_list: ['zoomvibes.j4red4llen.com'],
  oauth_callback_url: 'https://zoomvibes.j4red4llen.com/api/oauth/proxy/callback',
  webhook_proxy_base: 'https://zoomvibes.j4red4llen.com/api/webhook/proxy',
  default_scopes: ['meeting:read', 'meeting:write', 'user:read'],
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

  console.log('[ZoomAPI] Creating Zoom App:', request.manifest?.display_information?.name);

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
      throw new ZoomMarketplaceError(
        `App creation failed: ${errorData.message || response.statusText}`,
        'APP_CREATION_FAILED',
        response.status,
      );
    }

    const data = (await response.json()) as ZoomAppCreateResponse;
    console.log('[ZoomAPI] Zoom App created successfully:', data.app_id);

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
  shortDescription?: string;
  longDescription?: string;
  scopes?: string[];
  webhookSessionId?: string;
  productionHomeUri?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  termsOfUseUrl?: string;
}): ZoomAppManifest {
  const {
    appName,
    shortDescription = 'Built with Bolt.diy',
    longDescription = 'A Zoom App created using Bolt.diy - the AI-powered web development environment.',
    scopes = ZOOM_APP_DEFAULTS.default_scopes,
    webhookSessionId,
    productionHomeUri = '',
    supportUrl,
    privacyPolicyUrl,
    termsOfUseUrl,
  } = options;

  // Development home URI uses webhook proxy for local testing
  const developmentHomeUri = webhookSessionId
    ? `${ZOOM_APP_DEFAULTS.webhook_proxy_base}/${webhookSessionId}`
    : ZOOM_APP_DEFAULTS.webhook_proxy_base;

  return {
    display_information: {
      name: appName,
      short_description: shortDescription.slice(0, 50), // 50 char limit
      long_description: longDescription.slice(0, 4000), // 4000 char limit
      ...(supportUrl && { support_url: supportUrl }),
      ...(privacyPolicyUrl && { privacy_policy_url: privacyPolicyUrl }),
      ...(termsOfUseUrl && { terms_of_use_url: termsOfUseUrl }),
    },
    oauth_information: {
      redirect_uri: ZOOM_APP_DEFAULTS.oauth_callback_url,
      scopes,
    },
    features: {
      products: ['meetings'],
      development_home_uri: developmentHomeUri,
      production_home_uri: productionHomeUri,
      domain_allow_list: [...ZOOM_APP_DEFAULTS.domain_allow_list],
      in_client_feature: {
        collaborate: true,
        main_panel: true,
        camera: false,
        custom_background: false,
      },
      zoom_client_support: {
        windows: true,
        mac: true,
        linux: true,
        ios: false,
        android: false,
      },
      embed: {
        enabled: false,
        meeting: false,
        webinar: false,
      },
    },
  };
}

/**
 * Build complete app creation request
 *
 * @param manifestOptions - Options for manifest generation
 * @returns Complete request body for Marketplace API
 */
export function buildZoomAppCreateRequest(
  manifestOptions: Parameters<typeof buildZoomAppManifest>[0],
): ZoomAppCreateRequest {
  return {
    app_type: 'general',
    contact_name: ZOOM_APP_DEFAULTS.contact_name,
    contact_email: ZOOM_APP_DEFAULTS.contact_email,
    company_name: ZOOM_APP_DEFAULTS.company_name,
    active: true,
    manifest: buildZoomAppManifest(manifestOptions),
  };
}

/**
 * Generate .env file content with Zoom App credentials
 *
 * @param credentials - Development and production credentials from API response
 * @param appId - The created app ID
 * @returns String content for .env file
 */
export function generateEnvFileContent(credentials: ZoomAppCreateResponse): string {
  return `# ======================================
# Zoom App Credentials
# Auto-generated by Bolt.diy on ${new Date().toISOString()}
# ======================================

# App ID: ${credentials.app_id}
# App Name: ${credentials.app_name}
# Created: ${credentials.created_at}

# Development Credentials (use for local testing)
VITE_ZOOM_CLIENT_ID=${credentials.development_credentials.client_id}
ZOOM_CLIENT_SECRET=${credentials.development_credentials.client_secret}

# OAuth redirect URL (bolt.diy proxy for development)
VITE_OAUTH_REDIRECT_URL=${ZOOM_APP_DEFAULTS.oauth_callback_url}

# Production Credentials (uncomment when deploying to Vercel/Netlify/etc.)
# VITE_ZOOM_PROD_CLIENT_ID=${credentials.production_credentials.client_id}
# ZOOM_PROD_CLIENT_SECRET=${credentials.production_credentials.client_secret}

# Scopes: ${credentials.scopes.join(', ')}
`;
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
