import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { destroySession, isAuthEnabled } from '~/lib/auth.server';

export async function action({ request, context }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Extract Cloudflare env from context (for Workers/Kubernetes deployments)
  const cloudflareEnv = (context as any)?.cloudflare?.env as Record<string, string> | undefined;

  // Check if auth is enabled
  if (!isAuthEnabled(cloudflareEnv)) {
    return json({ error: 'Authentication not configured' }, { status: 400 });
  }

  // Destroy the session
  const cookieHeader = request.headers.get('Cookie');
  const destroyCookie = await destroySession(cookieHeader);

  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': destroyCookie,
      },
    },
  );
}

export async function loader({ context }: LoaderFunctionArgs) {
  // Extract Cloudflare env from context (for Workers/Kubernetes deployments)
  const cloudflareEnv = (context as any)?.cloudflare?.env as Record<string, string> | undefined;

  // GET request - redirect to login page after logout (for simple logout links)
  if (!isAuthEnabled(cloudflareEnv)) {
    throw redirect('/');
  }

  return json({ error: 'Use POST method to logout' }, { status: 405 });
}
