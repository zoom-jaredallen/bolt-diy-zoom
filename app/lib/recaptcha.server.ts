/**
 * reCAPTCHA v2 verification helper
 *
 * Free tier: Unlimited verifications
 * Setup: https://www.google.com/recaptcha/admin/create
 */

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Get reCAPTCHA secret key from environment
 */
export function getRecaptchaSecretKey(): string | null {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY || (globalThis as any).process?.env?.RECAPTCHA_SECRET_KEY || null;

  return secretKey && secretKey !== 'your_recaptcha_secret_key_here' ? secretKey : null;
}

/**
 * Get reCAPTCHA site key from environment (for client-side)
 */
export function getRecaptchaSiteKey(): string | null {
  const siteKey =
    process.env.VITE_RECAPTCHA_SITE_KEY || (globalThis as any).process?.env?.VITE_RECAPTCHA_SITE_KEY || null;

  return siteKey && siteKey !== 'your_recaptcha_site_key_here' ? siteKey : null;
}

/**
 * Check if reCAPTCHA is enabled
 */
export function isRecaptchaEnabled(): boolean {
  return getRecaptchaSecretKey() !== null && getRecaptchaSiteKey() !== null;
}

interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verify a reCAPTCHA token
 *
 * @param token - The reCAPTCHA response token from the client
 * @param remoteIP - Optional client IP for additional validation
 * @returns True if verification succeeded, false otherwise
 */
export async function verifyRecaptcha(token: string, remoteIP?: string): Promise<boolean> {
  const secretKey = getRecaptchaSecretKey();

  if (!secretKey) {
    console.warn('reCAPTCHA secret key not configured, skipping verification');

    return true;
  }

  if (!token) {
    console.warn('reCAPTCHA token missing');

    return false;
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    if (remoteIP) {
      params.append('remoteip', remoteIP);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('reCAPTCHA verification request failed:', response.status);

      return false;
    }

    const data: RecaptchaVerifyResponse = await response.json();

    if (!data.success) {
      console.warn('reCAPTCHA verification failed:', data['error-codes']);

      return false;
    }

    return true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);

    return false;
  }
}
