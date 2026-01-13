/**
 * Webhook Session Management Endpoint
 *
 * Allows creating and managing webhook proxy sessions.
 *
 * Usage:
 * POST /api/webhook/session - Create a new session
 * GET /api/webhook/session?sessionId=xxx - Get session info
 * DELETE /api/webhook/session?sessionId=xxx - Delete session
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import {
  createWebhookSession,
  getWebhookSession,
  deleteWebhookSession,
  getQueueStatus,
  buildWebhookUrl,
  getAllSessions,
} from '~/lib/services/webhook-proxy';

function getEnvVar(context: any, key: string): string {
  return (context.cloudflare?.env as any)?.[key] || process.env[key] || '';
}

// GET - Get session info or list all sessions
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  const listAll = url.searchParams.get('list') === 'true';

  // List all sessions (for admin/debugging)
  if (listAll) {
    const sessions = getAllSessions();

    return new Response(
      JSON.stringify({
        success: true,
        sessions: sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          lastPollAt: s.lastPollAt,
          webcontainerId: s.webcontainerId,
          description: s.description,
        })),
        count: sessions.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Get specific session
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = getWebhookSession(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found or expired' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const queueStatus = getQueueStatus(sessionId);
  const publicUrl = getEnvVar(context, 'VITE_PUBLIC_URL') || new URL(request.url).origin;

  return new Response(
    JSON.stringify({
      success: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        lastPollAt: session.lastPollAt,
        webcontainerId: session.webcontainerId,
        description: session.description,
        webhookUrl: buildWebhookUrl(publicUrl, session.id),
        queue: queueStatus,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

// POST - Create new session, DELETE - Delete session
export async function action({ request, context }: ActionFunctionArgs) {
  const method = request.method.toUpperCase();

  if (method === 'POST') {
    return handleCreateSession(request, context);
  } else if (method === 'DELETE') {
    return handleDeleteSession(request);
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleCreateSession(request: Request, context: any): Promise<Response> {
  let webcontainerId: string | undefined;
  let description: string | undefined;

  // Parse request body if present
  const contentType = request.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    try {
      const body = await request.json();
      webcontainerId = (body as any).webcontainerId;
      description = (body as any).description;
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  // Create session
  const session = createWebhookSession(webcontainerId, description);

  // Get public URL for webhook URL
  const publicUrl = getEnvVar(context, 'VITE_PUBLIC_URL') || new URL(request.url).origin;

  return new Response(
    JSON.stringify({
      success: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        webcontainerId: session.webcontainerId,
        description: session.description,
        webhookUrl: buildWebhookUrl(publicUrl, session.id),
        pollUrl: `${publicUrl}/api/webhook/poll/${session.id}`,
      },
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function handleDeleteSession(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    // Try to get from body
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        const bodySessionId = (body as any).sessionId;

        if (bodySessionId) {
          deleteWebhookSession(bodySessionId);

          return new Response(JSON.stringify({ success: true, message: 'Session deleted' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  deleteWebhookSession(sessionId);

  return new Response(JSON.stringify({ success: true, message: 'Session deleted' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
