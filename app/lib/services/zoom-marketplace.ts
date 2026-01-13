/**
 * Zoom Marketplace Service
 *
 * Provides utilities for generating Zoom Marketplace manifests,
 * validating configurations, and managing Zoom App settings.
 */

/**
 * Zoom App manifest configuration
 */
export interface ZoomManifestConfig {
  appName: string;
  shortDescription: string;
  longDescription: string;
  developerName: string;
  developerEmail: string;
  homeUrl: string;
  redirectUrl: string;
  scopes: string[];
  webhookUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

/**
 * Zoom App manifest structure
 */
export interface ZoomManifest {
  appInfo: {
    appName: string;
    shortDescription: string;
    longDescription: string;
    developer: {
      name: string;
      email: string;
    };
    supportUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };
  oauth: {
    redirectUrl: string;
    scopes: string[];
  };
  features: {
    homeUrl: string;
    meetingApp: boolean;
  };
  webhooks?: {
    eventSubscription: {
      eventTypes: string[];
      notificationUrl: string;
    };
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Default OAuth scopes for Zoom Apps
 */
export const DEFAULT_ZOOM_SCOPES = ['meeting:read', 'meeting:write', 'user:read'];

/**
 * Available webhook event types
 */
export const ZOOM_WEBHOOK_EVENTS = [
  'meeting.started',
  'meeting.ended',
  'meeting.participant_joined',
  'meeting.participant_left',
  'meeting.created',
  'meeting.deleted',
  'meeting.updated',
  'recording.completed',
  'recording.started',
  'recording.stopped',
] as const;

/**
 * Stable OAuth callback URL for bolt.diy proxy
 */
export const ZOOM_OAUTH_CALLBACK_URL = 'https://zoomvibes.j4red4llen.com/api/oauth/proxy/callback';

/**
 * Stable webhook proxy base URL
 */
export const ZOOM_WEBHOOK_PROXY_BASE = 'https://zoomvibes.j4red4llen.com/api/webhook/proxy';

/**
 * Generate a Zoom Marketplace manifest
 */
export function generateManifest(config: ZoomManifestConfig): ZoomManifest {
  const manifest: ZoomManifest = {
    appInfo: {
      appName: config.appName,
      shortDescription: config.shortDescription.slice(0, 50), // Enforce 50 char limit
      longDescription: config.longDescription.slice(0, 4000), // Enforce 4000 char limit
      developer: {
        name: config.developerName,
        email: config.developerEmail,
      },
    },
    oauth: {
      redirectUrl: config.redirectUrl,
      scopes: config.scopes,
    },
    features: {
      homeUrl: config.homeUrl,
      meetingApp: true,
    },
  };

  // Add optional URLs
  if (config.supportUrl) {
    manifest.appInfo.supportUrl = config.supportUrl;
  }

  if (config.privacyPolicyUrl) {
    manifest.appInfo.privacyPolicyUrl = config.privacyPolicyUrl;
  }

  if (config.termsOfServiceUrl) {
    manifest.appInfo.termsOfServiceUrl = config.termsOfServiceUrl;
  }

  // Add webhooks if URL is provided
  if (config.webhookUrl) {
    manifest.webhooks = {
      eventSubscription: {
        eventTypes: ['meeting.started', 'meeting.ended'],
        notificationUrl: config.webhookUrl,
      },
    };
  }

  return manifest;
}

/**
 * Validate a Zoom manifest configuration
 */
export function validateManifestConfig(config: ZoomManifestConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!config.appName || config.appName.trim().length === 0) {
    errors.push('App name is required');
  }

  if (!config.shortDescription || config.shortDescription.trim().length === 0) {
    errors.push('Short description is required');
  } else if (config.shortDescription.length > 50) {
    warnings.push('Short description will be truncated to 50 characters');
  }

  if (!config.longDescription || config.longDescription.trim().length === 0) {
    errors.push('Long description is required');
  } else if (config.longDescription.length > 4000) {
    warnings.push('Long description will be truncated to 4000 characters');
  }

  if (!config.developerName || config.developerName.trim().length === 0) {
    errors.push('Developer name is required');
  }

  if (!config.developerEmail || config.developerEmail.trim().length === 0) {
    errors.push('Developer email is required');
  } else if (!isValidEmail(config.developerEmail)) {
    errors.push('Invalid developer email format');
  }

  // URL validation
  if (!config.homeUrl || config.homeUrl.trim().length === 0) {
    errors.push('Home URL is required');
  } else {
    if (!config.homeUrl.startsWith('https://')) {
      errors.push('Home URL must use HTTPS');
    }

    if (isEphemeralUrl(config.homeUrl)) {
      warnings.push('Home URL appears to be an ephemeral WebContainer URL. This will not work in production.');
    }
  }

  if (!config.redirectUrl || config.redirectUrl.trim().length === 0) {
    errors.push('Redirect URL is required');
  } else if (!config.redirectUrl.startsWith('https://')) {
    errors.push('Redirect URL must use HTTPS');
  }

  // Scopes validation
  if (!config.scopes || config.scopes.length === 0) {
    errors.push('At least one OAuth scope is required');
  }

  // Webhook URL validation (optional)
  if (config.webhookUrl) {
    if (!config.webhookUrl.startsWith('https://')) {
      errors.push('Webhook URL must use HTTPS');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a URL is likely an ephemeral WebContainer URL
 */
export function isEphemeralUrl(url: string): boolean {
  const ephemeralPatterns = [/\.webcontainer-api\.io/, /\.stackblitz\.io/, /localhost/, /127\.0\.0\.1/, /0\.0\.0\.0/];

  return ephemeralPatterns.some((pattern) => pattern.test(url));
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a webhook URL for the proxy
 */
export function generateWebhookUrl(sessionId: string): string {
  return `${ZOOM_WEBHOOK_PROXY_BASE}/${sessionId}`;
}

/**
 * Generate default manifest config with sensible defaults
 */
export function getDefaultManifestConfig(): Partial<ZoomManifestConfig> {
  return {
    redirectUrl: ZOOM_OAUTH_CALLBACK_URL,
    scopes: [...DEFAULT_ZOOM_SCOPES],
    shortDescription: '',
    longDescription: '',
    appName: '',
    developerName: '',
    developerEmail: '',
    homeUrl: '',
  };
}

/**
 * Convert manifest to JSON string for download
 */
export function manifestToJson(manifest: ZoomManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Parse manifest from JSON string
 */
export function parseManifestJson(json: string): ZoomManifest | null {
  try {
    const parsed = JSON.parse(json);

    // Basic validation
    if (!parsed.appInfo || !parsed.oauth || !parsed.features) {
      return null;
    }

    return parsed as ZoomManifest;
  } catch {
    return null;
  }
}

/**
 * Check if secrets might be exposed in code
 */
export function detectExposedSecrets(code: string): string[] {
  const warnings: string[] = [];

  const secretPatterns = [
    { pattern: /client_secret\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Client Secret' },
    { pattern: /ZOOM_CLIENT_SECRET\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Zoom Client Secret' },
    { pattern: /api_secret\s*[:=]\s*['"][^'"]+['"]/gi, name: 'API Secret' },
    { pattern: /verification_token\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Verification Token' },
  ];

  for (const { pattern, name } of secretPatterns) {
    if (pattern.test(code)) {
      warnings.push(`Potential ${name} exposure detected`);
    }
  }

  return warnings;
}
