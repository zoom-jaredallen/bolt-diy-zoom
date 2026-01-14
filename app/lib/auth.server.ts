/**
 * Basic Authentication middleware for bolt.diy
 *
 * Protects the web interface with username/password authentication.
 * OAuth and webhook endpoints are excluded to allow external integrations.
 */

// Paths that should NOT require authentication
const PUBLIC_PATHS = [
  '/api/oauth/proxy/start',
  '/api/oauth/proxy/callback',
  '/api/webhook/proxy/',
  '/api/webhook/poll/',
  '/api/webhook/session',
  '/api/health',
  '/favicon',
  '/icons/',
  '/logo',
  '/apple-touch-icon',
];

// Default username
const AUTH_USERNAME = 'admin';

/**
 * Check if a path should be publicly accessible (no auth required)
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Get admin password from environment
 * Returns null if not configured (auth disabled)
 */
export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD || (globalThis as any).process?.env?.ADMIN_PASSWORD || null;

  return password && password !== 'your_secure_password_here' ? password : null;
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return getAdminPassword() !== null;
}

/**
 * Validate Basic Auth credentials
 */
export function validateBasicAuth(authHeader: string | null): boolean {
  const password = getAdminPassword();

  if (!password) {
    // Auth not configured, allow access
    return true;
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, providedPassword] = credentials.split(':');

    return username === AUTH_USERNAME && providedPassword === password;
  } catch {
    return false;
  }
}

/**
 * Create 401 Unauthorized response with WWW-Authenticate header
 */
export function createUnauthorizedResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="bolt.diy", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Check authentication for a request
 * Returns null if authorized, or a 401 Response if not
 */
export function checkAuth(request: Request): Response | null {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip auth for public paths
  if (isPublicPath(pathname)) {
    return null;
  }

  // Skip auth if not configured
  if (!isAuthEnabled()) {
    return null;
  }

  // Validate credentials
  const authHeader = request.headers.get('Authorization');

  if (!validateBasicAuth(authHeader)) {
    return createUnauthorizedResponse();
  }

  return null;
}
