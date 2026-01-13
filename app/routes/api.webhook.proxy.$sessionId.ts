/**
 * Webhook Proxy Receiver Endpoint
 *
 * Receives webhooks from external services and queues them for the WebContainer app.
 * Supports all HTTP methods (GET, POST, PUT, DELETE, PATCH).
 *
 * Usage:
 * Configure external service to send webhooks to:
 * https://your-domain.com/api/webhook/proxy/{sessionId}
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { addWebhookEvent, getWebhookSession } from '~/lib/services/webhook-proxy';

// Handle GET requests (some webhooks use GET)
export async function loader({ request, params }: LoaderFunctionArgs) {
  return handleWebhook(request, params.sessionId, 'GET');
}

// Handle POST, PUT, DELETE, PATCH requests
export async function action({ request, params }: ActionFunctionArgs) {
  return handleWebhook(request, params.sessionId, request.method);
}

async function handleWebhook(request: Request, sessionId: string | undefined, method: string): Promise<Response> {
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

  // Extract request details
  const url = new URL(request.url);
  const path = url.pathname.replace(`/api/webhook/proxy/${sessionId}`, '') || '/';

  // Convert headers to plain object
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    // Skip internal headers
    if (!key.toLowerCase().startsWith('cf-') && key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  });

  // Convert query params to plain object
  const query: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Get content type
  const contentType = request.headers.get('content-type');

  // Read body for non-GET requests
  let body: string | null = null;

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = null;
    }
  }

  // Add event to queue
  const event = addWebhookEvent(sessionId, method, path, headers, query, body, contentType);

  if (!event) {
    return new Response(JSON.stringify({ error: 'Failed to queue webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* Return success response - many webhook providers expect a 200 response */
  return new Response(
    JSON.stringify({
      success: true,
      eventId: event.id,
      message: 'Webhook received and queued',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
