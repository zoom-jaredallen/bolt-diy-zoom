/**
 * OAuth Token Retrieval Endpoint
 *
 * Allows WebContainer projects to poll for OAuth tokens after authorization.
 * This is a one-time read endpoint - tokens are cleared after retrieval for security.
 *
 * GET /api/oauth/tokens/:projectId
 *
 * Response:
 * - 200 { success: true, tokens: {...} } - Tokens available and returned
 * - 200 { success: false, pending: true } - Authorization not yet completed
 * - 404 { success: false, error: '...' } - Project not found
 */

import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { getProjectCredentials, getAndClearProjectTokens, hasProjectTokens } from '~/lib/services/project-store';

/**
 * GET /api/oauth/tokens/:projectId
 *
 * Poll for OAuth tokens. Returns tokens if available, or pending status.
 * Tokens are cleared after first successful retrieval (one-time read).
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { projectId } = params;

  // Validate projectId
  if (!projectId) {
    return json(
      {
        success: false,
        error: 'Missing project ID',
      },
      { status: 400 },
    );
  }

  console.log(`[TokenEndpoint] Checking tokens for project: ${projectId}`);

  // First check if project exists
  const credentials = await getProjectCredentials(projectId);

  if (!credentials) {
    console.log(`[TokenEndpoint] Project not found: ${projectId}`);

    return json(
      {
        success: false,
        error: 'Project not found or expired',
        hint: 'The project may have expired. Please recreate the Zoom App.',
      },
      { status: 404 },
    );
  }

  // Check if tokens are available (without retrieving)
  if (!hasProjectTokens(projectId)) {
    console.log(`[TokenEndpoint] No tokens yet for project: ${projectId}`);

    return json({
      success: false,
      pending: true,
      message: 'Authorization not yet completed. Please authorize the app in Zoom Marketplace.',
      project: {
        projectId,
        appId: credentials.appId,
        appName: credentials.appName,
      },
    });
  }

  // Retrieve and clear tokens (one-time read)
  const tokens = await getAndClearProjectTokens(projectId);

  if (!tokens) {
    // Race condition: tokens were cleared between check and retrieval
    return json({
      success: false,
      pending: true,
      message: 'Tokens were already retrieved. Please authorize again if needed.',
    });
  }

  console.log(`[TokenEndpoint] Returning tokens for project: ${projectId}`);

  return json({
    success: true,
    tokens: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    },
    project: {
      projectId,
      appId: credentials.appId,
      appName: credentials.appName,
    },
    note: 'Tokens have been cleared from the server. Store them securely in your application.',
  });
}
