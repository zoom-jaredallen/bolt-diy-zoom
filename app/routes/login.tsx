import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { isRecaptchaEnabled, getRecaptchaSiteKey } from '~/lib/recaptcha.server';
import { isAuthEnabled, checkRateLimit, getClientIP } from '~/lib/auth.server';

interface LoaderData {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  rateLimited: boolean;
  resetIn: number;
  remainingAttempts: number;
}

interface LoginResponse {
  success?: boolean;
  error?: string;
  redirect?: string;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      reset: () => void;
    };
    onRecaptchaLoad: () => void;
  }
}

export const meta: MetaFunction = () => {
  return [{ title: 'Login - bolt.diy' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // If auth is not enabled, redirect to home
  if (!isAuthEnabled()) {
    throw redirect('/');
  }

  const ip = getClientIP(request);
  const rateLimit = checkRateLimit(ip);
  const recaptchaEnabled = isRecaptchaEnabled();
  const recaptchaSiteKey = recaptchaEnabled ? getRecaptchaSiteKey() : null;

  return json<LoaderData>({
    recaptchaEnabled,
    recaptchaSiteKey,
    rateLimited: !rateLimit.allowed,
    resetIn: rateLimit.resetIn,
    remainingAttempts: rateLimit.remainingAttempts,
  });
}

export default function LoginPage() {
  const { recaptchaEnabled, recaptchaSiteKey, rateLimited, resetIn, remainingAttempts } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const errorParam = searchParams.get('error');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(errorParam || '');
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFormData = useRef<FormData | null>(null);

  // Initialize reCAPTCHA when loaded
  useEffect(() => {
    if (recaptchaEnabled && recaptchaSiteKey) {
      window.onRecaptchaLoad = () => {
        setRecaptchaReady(true);
      };

      // Check if already loaded
      if (window.grecaptcha?.ready) {
        window.grecaptcha.ready(() => {
          setRecaptchaReady(true);
        });
      }
    }
  }, [recaptchaEnabled, recaptchaSiteKey]);

  // Submit the form with reCAPTCHA token
  const submitWithToken = useCallback(
    async (formData: FormData, recaptchaToken: string) => {
      formData.append('recaptchaToken', recaptchaToken);
      formData.append('redirect', redirectTo);

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          body: formData,
        });

        const data = (await response.json()) as LoginResponse;

        if (response.ok && data.success) {
          window.location.href = data.redirect || '/';
        } else {
          setError(data.error || 'Login failed');
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setIsSubmitting(false);
        pendingFormData.current = null;
      }
    },
    [redirectTo],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    // If reCAPTCHA is enabled, get token using invisible v2/v3
    if (recaptchaEnabled && recaptchaSiteKey && window.grecaptcha) {
      try {
        // Store form data for callback
        pendingFormData.current = formData;

        // Execute invisible reCAPTCHA (v2 invisible or v3)
        const token = await window.grecaptcha.execute(recaptchaSiteKey, { action: 'login' });

        if (token) {
          await submitWithToken(formData, token);
        } else {
          setError('reCAPTCHA verification failed. Please try again.');
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error('reCAPTCHA error:', err);
        setError('reCAPTCHA error. Please try again.');
        setIsSubmitting(false);
      }
    } else {
      // No reCAPTCHA, submit directly
      await submitWithToken(formData, '');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1">
      <div className="w-full max-w-md p-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg border border-bolt-elements-borderColor">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="bolt.diy" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">Login to bolt.diy</h1>
          <p className="text-bolt-elements-textSecondary mt-2">Enter your credentials to continue</p>
        </div>

        {rateLimited ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Too many failed attempts.</strong>
            <p>Please try again in {Math.ceil(resetIn / 60)} minute(s).</p>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                defaultValue="admin"
                required
                className="w-full px-4 py-2 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                className="w-full px-4 py-2 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || rateLimited || (recaptchaEnabled && !recaptchaReady)}
              className="w-full py-3 px-4 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : recaptchaEnabled && !recaptchaReady ? 'Loading...' : 'Sign In'}
            </button>

            {remainingAttempts < 5 && (
              <p className="text-sm text-amber-600 text-center">
                {remainingAttempts} attempt(s) remaining before lockout
              </p>
            )}

            {recaptchaEnabled && (
              <p className="text-xs text-bolt-elements-textTertiary text-center">Protected by reCAPTCHA</p>
            )}
          </form>
        )}
      </div>

      {/* Load reCAPTCHA v3/invisible script */}
      {recaptchaEnabled && recaptchaSiteKey && (
        <script
          src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}&onload=onRecaptchaLoad`}
          async
          defer
        />
      )}
    </div>
  );
}
