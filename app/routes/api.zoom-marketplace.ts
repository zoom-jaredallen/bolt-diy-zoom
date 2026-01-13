/**
 * Zoom Marketplace API Route
 *
 * Provides endpoints for generating and validating Zoom Marketplace manifests.
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import {
  generateManifest,
  validateManifestConfig,
  getDefaultManifestConfig,
  manifestToJson,
  detectExposedSecrets,
  ZOOM_OAUTH_CALLBACK_URL,
  ZOOM_WEBHOOK_PROXY_BASE,
  DEFAULT_ZOOM_SCOPES,
  type ZoomManifestConfig,
} from '~/lib/services/zoom-marketplace';

/**
 * GET /api/zoom-marketplace
 * Returns default configuration and constants
 */
export async function loader() {
  return json({
    defaultConfig: getDefaultManifestConfig(),
    constants: {
      oauthCallbackUrl: ZOOM_OAUTH_CALLBACK_URL,
      webhookProxyBase: ZOOM_WEBHOOK_PROXY_BASE,
      defaultScopes: DEFAULT_ZOOM_SCOPES,
    },
  });
}

/**
 * POST /api/zoom-marketplace
 * Generate or validate a manifest
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.json();
    const {
      action: actionType,
      config,
      code,
    } = body as {
      action: 'generate' | 'validate' | 'check-secrets';
      config?: ZoomManifestConfig;
      code?: string;
    };

    switch (actionType) {
      case 'generate': {
        if (!config) {
          return json({ error: 'Config is required for manifest generation' }, { status: 400 });
        }

        // Validate first
        const validation = validateManifestConfig(config);

        if (!validation.valid) {
          return json(
            {
              error: 'Invalid configuration',
              validation,
            },
            { status: 400 },
          );
        }

        // Generate manifest
        const manifest = generateManifest(config);
        const manifestJson = manifestToJson(manifest);

        return json({
          success: true,
          manifest,
          manifestJson,
          validation,
        });
      }

      case 'validate': {
        if (!config) {
          return json({ error: 'Config is required for validation' }, { status: 400 });
        }

        const validation = validateManifestConfig(config);

        return json({
          success: true,
          validation,
        });
      }

      case 'check-secrets': {
        if (!code) {
          return json({ error: 'Code is required for secret detection' }, { status: 400 });
        }

        const warnings = detectExposedSecrets(code);

        return json({
          success: true,
          hasExposedSecrets: warnings.length > 0,
          warnings,
        });
      }

      default:
        return json({ error: 'Invalid action. Use: generate, validate, or check-secrets' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in zoom-marketplace API:', error);

    return json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
