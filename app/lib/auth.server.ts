/**
 * Authentication middleware for bolt.diy
 *
 * Features:
 * - Session-based authentication with secure cookies
 * - Rate limiting for brute force protection
 * - reCAPTCHA support for bot prevention
 * - OAuth and webhook endpoints excluded from auth
 */

import { createCookie } from '@remix-run/cloudflare';

// Paths that should NOT require authentication
const PUBLIC_PATHS = [
  '/api/oauth/proxy/start',
  '/api/oauth/proxy/callback',
  '/api/webhook/proxy/',
  '/api/webhook/poll/',
  '/api/webhook/session',
  '/api/health',
  '/api/login',
  '/login',
  '/favicon',
  '/icons/',
  '/logo',
  '/apple-touch-icon',
];

// Default username
export const AUTH_USERNAME = 'admin';

// Rate limiting configuration
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Session cookie configuration
const SESSION_COOKIE_NAME = 'bolt_session';
const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// In-memory rate limiting store (per IP)
const rateLimitStore = new Map<string, { attempts: number; resetTime: number }>();

// In-memory session store
const sessionStore = new Map<string, { username: string; createdAt: number }>();

// Session cookie
export const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: SESSION_MAX_AGE,
  path: '/',
});

/**
 * Check if a path should be publicly accessible (no auth required)
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Get admin password from environment
 * Returns null if not configured (auth disabled)
 * @param cloudflareEnv - Optional Cloudflare environment (for Workers/wrangler)
 */
export function getAdminPassword(cloudflareEnv?: Record<string, string>): string | null {
  /*
   * Try Cloudflare env first (for Workers/Kubernetes deployments)
   * Then fall back to process.env (for local development)
   */
  const password =
    cloudflareEnv?.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    (globalThis as any).process?.env?.ADMIN_PASSWORD ||
    null;

  return password && password !== 'your_secure_password_here' ? password : null;
}

/**
 * Check if authentication is enabled
 * @param cloudflareEnv - Optional Cloudflare environment (for Workers/wrangler)
 */
export function isAuthEnabled(cloudflareEnv?: Record<string, string>): boolean {
  return getAdminPassword(cloudflareEnv) !== null;
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');

  if (realIP) {
    return realIP;
  }

  return '127.0.0.1';
}

/**
 * Check rate limit for an IP
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS, resetIn: 0 };
  }

  const remainingAttempts = Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - record.attempts);
  const resetIn = Math.ceil((record.resetTime - now) / 1000);

  return {
    allowed: record.attempts < RATE_LIMIT_MAX_ATTEMPTS,
    remainingAttempts,
    resetIn,
  };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { attempts: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    record.attempts++;
  }
}

/**
 * Clear rate limit for an IP (on successful login)
 */
export function clearRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session for a user
 */
export async function createSession(username: string): Promise<string> {
  const sessionId = generateSessionId();
  sessionStore.set(sessionId, { username, createdAt: Date.now() });

  return sessionCookie.serialize(sessionId);
}

/**
 * Validate a session from cookie header
 */
export async function validateSession(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) {
    return null;
  }

  const sessionId = await sessionCookie.parse(cookieHeader);

  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  const sessionAge = Date.now() - session.createdAt;

  if (sessionAge > SESSION_MAX_AGE * 1000) {
    sessionStore.delete(sessionId);

    return null;
  }

  return session.username;
}

/**
 * Destroy a session
 */
export async function destroySession(cookieHeader: string | null): Promise<string> {
  if (cookieHeader) {
    const sessionId = await sessionCookie.parse(cookieHeader);

    if (sessionId && typeof sessionId === 'string') {
      sessionStore.delete(sessionId);
    }
  }

  return sessionCookie.serialize('', { maxAge: 0 });
}

/**
 * Validate credentials
 * @param cloudflareEnv - Optional Cloudflare environment (for Workers/wrangler)
 */
export function validateCredentials(
  username: string,
  password: string,
  cloudflareEnv?: Record<string, string>,
): boolean {
  const adminPassword = getAdminPassword(cloudflareEnv);

  if (!adminPassword) {
    return false;
  }

  return username === AUTH_USERNAME && password === adminPassword;
}

/**
 * Check authentication for a request
 * Returns null if authorized, or a redirect/401 Response if not
 * @param cloudflareEnv - Optional Cloudflare environment (for Workers/wrangler)
 */
export async function checkAuth(request: Request, cloudflareEnv?: Record<string, string>): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip auth for public paths
  if (isPublicPath(pathname)) {
    return null;
  }

  // Skip auth if not configured
  if (!isAuthEnabled(cloudflareEnv)) {
    return null;
  }

  // Check for valid session cookie
  const cookieHeader = request.headers.get('Cookie');
  const username = await validateSession(cookieHeader);

  if (username) {
    return null;
  }

  // Check for Basic Auth header (backward compatibility for API clients)
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.slice(6);
      const credentials = atob(base64Credentials);
      const [user, pass] = credentials.split(':');

      if (validateCredentials(user, pass, cloudflareEnv)) {
        return null;
      }
    } catch {
      // Invalid base64
    }
  }

  // Redirect to login page for browser requests
  const acceptHeader = request.headers.get('Accept') || '';

  if (acceptHeader.includes('text/html')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    // Use proper redirect response (Response.redirect causes issues with Remix/Cloudflare)
    return new Response(null, {
      status: 302,
      headers: {
        Location: loginUrl.toString(),
      },
    });
  }

  // Return 401 for API requests
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="bolt.diy", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Clean up expired sessions and rate limit records
 * Call this periodically (e.g., every hour)
 */
export function cleanupExpiredData(): void {
  const now = Date.now();

  // Clean up expired sessions
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_MAX_AGE * 1000) {
      sessionStore.delete(sessionId);
    }
  }

  // Clean up expired rate limit records
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredData, 60 * 60 * 1000);
