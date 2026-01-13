/**
 * Webhook Proxy Service
 *
 * Provides webhook proxy functionality for apps running in WebContainer.
 * Since WebContainer apps have ephemeral URLs, this service allows external
 * webhooks to be received at a stable URL and forwarded to the WebContainer app.
 *
 * Architecture:
 * - External service sends webhook to /api/webhook/proxy/{sessionId}
 * - Webhook is stored in an in-memory queue
 * - WebContainer app polls /api/webhook/poll/{sessionId} to retrieve webhooks
 */

export interface WebhookEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string | null;
  contentType: string | null;
}

export interface WebhookSession {
  id: string;
  createdAt: number;
  lastPollAt: number;
  webcontainerId?: string;
  description?: string;
}

// In-memory storage (consider Redis for production multi-instance)
const webhookQueues = new Map<string, WebhookEvent[]>();
const webhookSessions = new Map<string, WebhookSession>();

// Configuration
const MAX_QUEUE_SIZE = parseInt(process.env.WEBHOOK_PROXY_MAX_QUEUE || '100', 10);
const SESSION_TTL = parseInt(process.env.WEBHOOK_PROXY_TTL || '3600', 10) * 1000; // Default: 1 hour
const EVENT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);

  return `evt_${Date.now()}_${Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Create a new webhook session
 */
export function createWebhookSession(webcontainerId?: string, description?: string): WebhookSession {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session: WebhookSession = {
    id: sessionId,
    createdAt: now,
    lastPollAt: now,
    webcontainerId,
    description,
  };

  webhookSessions.set(sessionId, session);
  webhookQueues.set(sessionId, []);

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  return session;
}

/**
 * Get webhook session by ID
 */
export function getWebhookSession(sessionId: string): WebhookSession | null {
  const session = webhookSessions.get(sessionId);

  if (session) {
    const now = Date.now();

    // Check if session has expired (no activity for SESSION_TTL)
    if (now - session.lastPollAt > SESSION_TTL) {
      deleteWebhookSession(sessionId);

      return null;
    }

    return session;
  }

  return null;
}

/**
 * Delete webhook session and its queue
 */
export function deleteWebhookSession(sessionId: string): void {
  webhookSessions.delete(sessionId);
  webhookQueues.delete(sessionId);
}

/**
 * Add webhook event to session queue
 */
export function addWebhookEvent(
  sessionId: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  query: Record<string, string>,
  body: string | null,
  contentType: string | null,
): WebhookEvent | null {
  const session = getWebhookSession(sessionId);

  if (!session) {
    return null;
  }

  const queue = webhookQueues.get(sessionId);

  if (!queue) {
    return null;
  }

  // Enforce queue size limit
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest event
    queue.shift();
  }

  const event: WebhookEvent = {
    id: generateEventId(),
    sessionId,
    timestamp: Date.now(),
    method,
    path,
    headers,
    query,
    body,
    contentType,
  };

  queue.push(event);

  return event;
}

/**
 * Poll webhooks for a session
 * Returns all pending webhooks and clears them from the queue
 */
export function pollWebhooks(sessionId: string, limit?: number): WebhookEvent[] {
  const session = getWebhookSession(sessionId);

  if (!session) {
    return [];
  }

  // Update last poll time
  session.lastPollAt = Date.now();

  const queue = webhookQueues.get(sessionId);

  if (!queue || queue.length === 0) {
    return [];
  }

  // Get events (with optional limit)
  const events = limit ? queue.splice(0, limit) : queue.splice(0, queue.length);

  return events;
}

/**
 * Peek at webhooks without removing them
 */
export function peekWebhooks(sessionId: string, limit?: number): WebhookEvent[] {
  const session = getWebhookSession(sessionId);

  if (!session) {
    return [];
  }

  const queue = webhookQueues.get(sessionId);

  if (!queue || queue.length === 0) {
    return [];
  }

  return limit ? queue.slice(0, limit) : [...queue];
}

/**
 * Get queue status for a session
 */
export function getQueueStatus(sessionId: string): { count: number; oldestTimestamp: number | null } | null {
  const session = getWebhookSession(sessionId);

  if (!session) {
    return null;
  }

  const queue = webhookQueues.get(sessionId);

  if (!queue) {
    return null;
  }

  return {
    count: queue.length,
    oldestTimestamp: queue.length > 0 ? queue[0].timestamp : null,
  };
}

/**
 * Clean up expired sessions and events
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();

  for (const [sessionId, session] of webhookSessions.entries()) {
    // Remove expired sessions
    if (now - session.lastPollAt > SESSION_TTL) {
      deleteWebhookSession(sessionId);
      continue;
    }

    // Clean up old events in active sessions
    const queue = webhookQueues.get(sessionId);

    if (queue) {
      const validEvents = queue.filter((event) => now - event.timestamp < EVENT_TTL);

      if (validEvents.length !== queue.length) {
        webhookQueues.set(sessionId, validEvents);
      }
    }
  }
}

/**
 * Get all active sessions (for admin/debugging)
 */
export function getAllSessions(): WebhookSession[] {
  cleanupExpiredSessions();

  return Array.from(webhookSessions.values());
}

/**
 * Build the webhook URL for a session
 */
export function buildWebhookUrl(publicUrl: string, sessionId: string): string {
  return `${publicUrl}/api/webhook/proxy/${sessionId}`;
}
