/**
 * Webhook Poll Endpoint
 *
 * Allows WebContainer apps to poll for queued webhooks.
 * Returns and clears pending webhooks from the queue.
 *
 * Usage:
 * GET /api/webhook/poll/{sessionId}?limit=10
 */

import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { pollWebhooks, getWebhookSession, getQueueStatus } from '~/lib/services/webhook-proxy';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;

  // Validate session ID
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate session exists
  const session = getWebhookSession(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse optional limit parameter
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  // Get queue status before polling
  const statusBefore = getQueueStatus(sessionId);

  // Poll for webhooks (removes them from queue)
  const events = pollWebhooks(sessionId, limit);

  // Get queue status after polling
  const statusAfter = getQueueStatus(sessionId);

  return new Response(
    JSON.stringify({
      success: true,
      events,
      count: events.length,
      remaining: statusAfter?.count || 0,
      totalReceived: (statusBefore?.count || 0) + events.length,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}
