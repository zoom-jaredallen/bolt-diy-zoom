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
  appType: string;
  createdAt: string;
  scopes: string[];
  credentials: {
    development: ZoomAppCredentials;
    production: ZoomAppCredentials;
  };
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
  scopes?: string[];
  webhookSessionId?: string;
  shortDescription?: string;
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
  credentials?: {
    development: ZoomAppCredentials;
    production: ZoomAppCredentials;
  };
  envFileWritten?: boolean;
  error?: string;
}

/**
 * Zoom OAuth scopes commonly used in Zoom Apps
 */
export const ZOOM_OAUTH_SCOPES = {
  // Meeting scopes
  MEETING_READ: 'meeting:read',
  MEETING_WRITE: 'meeting:write',

  // User scopes
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_PROFILE_READ: 'user:read:profile',

  // Recording scopes
  RECORDING_READ: 'recording:read',
  RECORDING_WRITE: 'recording:write',

  // Webinar scopes
  WEBINAR_READ: 'webinar:read',
  WEBINAR_WRITE: 'webinar:write',

  // Chat scopes
  CHAT_MESSAGE_READ: 'chat_message:read',
  CHAT_MESSAGE_WRITE: 'chat_message:write',
  CHAT_CHANNEL_READ: 'chat_channel:read',
  CHAT_CHANNEL_WRITE: 'chat_channel:write',

  // Team chat scopes
  TEAM_CHAT_READ: 'team_chat:read',
  TEAM_CHAT_WRITE: 'team_chat:write',
} as const;

/**
 * Default scopes for a basic Zoom App
 */
export const DEFAULT_ZOOM_APP_SCOPES = [
  ZOOM_OAUTH_SCOPES.MEETING_READ,
  ZOOM_OAUTH_SCOPES.MEETING_WRITE,
  ZOOM_OAUTH_SCOPES.USER_READ,
];

/**
 * Zoom App products
 */
export type ZoomProduct = 'meetings' | 'webinars' | 'team_chat' | 'zoom_rooms' | 'contact_center';

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
