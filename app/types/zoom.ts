/**
 * Zoom App Types
 *
 * TypeScript type definitions for Zoom App integration,
 * Marketplace API, and app creation workflow.
 */

/**
 * Zoom App creation response from /api/zoom-app-create
 */
export interface ZoomAppCreateResult {
  success: boolean;
  appId: string;
  appName: string;

  /**
   * OAuth authorization URL that goes through our proxy.
   * This URL properly handles state parameter for CSRF protection.
   * Use this URL to authorize users for the app.
   */
  oauthAuthorizeUrl: string;

  /**
   * Direct Zoom OAuth URL (for reference only).
   * DO NOT use this directly - it doesn't include the state parameter
   * needed for proper OAuth flow.
   */
  directOAuthUrl?: string;
  credentials: ZoomAppCredentials;
  envContent: string;
}

/**
 * Zoom App credentials (client ID and secret)
 */
export interface ZoomAppCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Error response from Zoom App creation API
 */
export interface ZoomAppCreateError {
  success: false;
  error: string;
  code: ZoomAppErrorCode;
  hint?: string;
}

/**
 * Zoom App error codes
 */
export type ZoomAppErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_CREDENTIALS'
  | 'OAUTH_FAILED'
  | 'APP_CREATION_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'INTERNAL_ERROR';

/**
 * Request body for creating a Zoom App
 */
export interface ZoomAppCreateRequest {
  appName: string;
  previewId?: string;
  scopes?: string[];
  description?: string;
  longDescription?: string;
}

/**
 * API endpoint configuration status
 */
export interface ZoomAppConfigStatus {
  endpoint: string;
  method: string;
  description: string;
  configured: boolean;
  credentials: {
    ZOOM_CLIENT_ID: 'configured' | 'missing';
    ZOOM_CLIENT_SECRET: 'configured' | 'missing';
    ZOOM_ACCOUNT_ID: 'configured' | 'missing';
  };
}

/**
 * Zoom App template hook options
 */
export interface ZoomTemplateHookOptions {
  appName: string;
  projectPath: string;
  webcontainerId?: string;
}

/**
 * Zoom App template hook result
 */
export interface ZoomTemplateHookResult {
  success: boolean;
  appId?: string;
  credentials?: ZoomAppCredentials;
  envFileWritten?: boolean;
  error?: string;
}

/**
 * Zoom OAuth scopes commonly used in Zoom Apps
 *
 * Note: For General Apps (in-client Zoom Apps), use the new scope format
 * with product prefix (e.g., meeting:read:meeting instead of meeting:read)
 */
export const ZOOM_OAUTH_SCOPES = {
  // In-meeting scope (required for General Apps)
  ZOOMAPP_INMEETING: 'zoomapp:inmeeting',

  // Meeting scopes (new format)
  MEETING_READ_MEETING: 'meeting:read:meeting',
  MEETING_WRITE_MEETING: 'meeting:write:meeting',
  MEETING_READ_LIST_MEETINGS: 'meeting:read:list_meetings',

  // User scopes (new format)
  USER_READ_USER: 'user:read:user',
  USER_READ_EMAIL: 'user:read:email',

  // Recording scopes
  RECORDING_READ: 'recording:read:recording',
  RECORDING_WRITE: 'recording:write:recording',

  // Webinar scopes
  WEBINAR_READ: 'webinar:read:webinar',
  WEBINAR_WRITE: 'webinar:write:webinar',

  // Chat scopes
  CHAT_MESSAGE_READ: 'chat_message:read',
  CHAT_MESSAGE_WRITE: 'chat_message:write',

  // Team chat scopes
  TEAM_CHAT_READ: 'team_chat:read',
  TEAM_CHAT_WRITE: 'team_chat:write',
} as const;

/**
 * Default scopes for a General (in-client) Zoom App
 */
export const DEFAULT_ZOOM_APP_SCOPES = [ZOOM_OAUTH_SCOPES.MEETING_READ_MEETING, ZOOM_OAUTH_SCOPES.ZOOMAPP_INMEETING];

/**
 * Zoom App products (uppercase format for API)
 */
export type ZoomProduct =
  | 'ZOOM_MEETING'
  | 'ZOOM_PHONE'
  | 'ZOOM_CONTACT_CENTER'
  | 'ZOOM_WEBINAR'
  | 'ZOOM_TEAM_CHAT'
  | 'ZOOM_ROOMS';

/**
 * Zoom App types
 */
export type ZoomAppType = 'general' | 's2s_oauth' | 'chatbot' | 'team_chat';

/**
 * Zoom client platforms
 */
export interface ZoomClientSupport {
  windows: boolean;
  mac: boolean;
  linux: boolean;
  ios: boolean;
  android: boolean;
}

/**
 * Type guard to check if a response is a successful Zoom App creation
 */
export function isZoomAppCreateSuccess(
  response: ZoomAppCreateResult | ZoomAppCreateError,
): response is ZoomAppCreateResult {
  return response.success === true;
}

/**
 * Type guard to check if a response is a Zoom App creation error
 */
export function isZoomAppCreateError(
  response: ZoomAppCreateResult | ZoomAppCreateError,
): response is ZoomAppCreateError {
  return response.success === false;
}
