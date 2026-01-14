import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import {
  validateCredentials,
  createSession,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIP,
  isAuthEnabled,
} from '~/lib/auth.server';
import { verifyRecaptcha, isRecaptchaEnabled } from '~/lib/recaptcha.server';

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Check if auth is enabled
  if (!isAuthEnabled()) {
    return json({ error: 'Authentication not configured' }, { status: 400 });
  }

  const ip = getClientIP(request);

  // Check rate limit
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return json(
      {
        error: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.resetIn / 60)} minute(s).`,
        rateLimited: true,
        resetIn: rateLimit.resetIn,
      },
      { status: 429 },
    );
  }

  // Parse form data
  const formData = await request.formData();
  const username = formData.get('username')?.toString() || '';
  const password = formData.get('password')?.toString() || '';
  const recaptchaToken = formData.get('recaptchaToken')?.toString() || '';
  const redirectTo = formData.get('redirect')?.toString() || '/';

  // Validate required fields
  if (!username || !password) {
    return json({ error: 'Username and password are required' }, { status: 400 });
  }

  // Verify reCAPTCHA if enabled
  if (isRecaptchaEnabled()) {
    const recaptchaValid = await verifyRecaptcha(recaptchaToken, ip);

    if (!recaptchaValid) {
      return json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 });
    }
  }

  // Validate credentials
  if (!validateCredentials(username, password)) {
    recordFailedAttempt(ip);

    const updatedRateLimit = checkRateLimit(ip);

    return json(
      {
        error: 'Invalid username or password',
        remainingAttempts: updatedRateLimit.remainingAttempts,
      },
      { status: 401 },
    );
  }

  // Success! Create session
  clearRateLimit(ip);

  const sessionCookie = await createSession(username);

  return json(
    { success: true, redirect: redirectTo },
    {
      headers: {
        'Set-Cookie': sessionCookie,
      },
    },
  );
}

export async function loader() {
  return json({ error: 'Method not allowed' }, { status: 405 });
}
