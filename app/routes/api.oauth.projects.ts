/**
 * OAuth Projects Admin Endpoint
 *
 * Lists all active projects with their OAuth status.
 * Useful for debugging and administration.
 *
 * GET /api/oauth/projects
 *
 * Note: In a production environment, this should be protected with authentication.
 */

import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { listProjects } from '~/lib/services/project-store';

export async function loader(_args: LoaderFunctionArgs) {
  const projects = listProjects();

  return json({
    success: true,
    count: projects.length,
    projects: projects.map((p) => ({
      projectId: p.projectId,
      appId: p.appId,
      appName: p.appName,
      clientId: p.clientId.substring(0, 8) + '...', // Partial client ID for security
      createdAt: new Date(p.createdAt).toISOString(),
      hasTokens: p.hasTokens,
    })),
    note: 'To retrieve tokens for a project, use GET /api/oauth/tokens/{projectId}',
  });
}
