/**
 * WebContainer Preview Base Route
 *
 * This route handles requests to /webcontainer/preview without an ID.
 * It serves as a landing page for Zoom Apps and includes required OWASP security headers.
 *
 * Required by Zoom for:
 * - Home URL validation
 * - Security header checks
 *
 * See: https://developers.zoom.us/docs/zoom-apps/security/owasp/
 */

import { json, type LoaderFunctionArgs, type HeadersFunction } from '@remix-run/cloudflare';

/**
 * OWASP Security Headers required for Zoom Apps
 * Must be included in responses for apps to be loaded in Zoom client iframe.
 */
const OWASP_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "frame-ancestors 'self' https://*.zoom.us",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'ALLOW-FROM https://*.zoom.us',
};

/**
 * Headers export - Remix uses this to set headers on the final HTML response
 * This is the proper way to set security headers on rendered pages
 */
export const headers: HeadersFunction = () => {
  return OWASP_HEADERS;
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle HEAD requests (used by Zoom for validation)
  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...OWASP_HEADERS,
        'Content-Type': 'text/html',
      },
    });
  }

  // Return JSON for API-style requests
  const acceptHeader = request.headers.get('Accept') || '';

  if (acceptHeader.includes('application/json')) {
    return json(
      {
        status: 'ready',
        message: 'WebContainer preview endpoint',
        usage: 'Access /webcontainer/preview/{id} with a valid preview ID',
      },
      { headers: OWASP_HEADERS },
    );
  }

  // Return data for the component - headers will be added by the headers export
  return json({ ready: true }, { headers: OWASP_HEADERS });
}

export default function WebContainerPreviewBase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-blue-600 rounded-2xl flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Zoom App Preview</h1>
        <p className="text-slate-400 mb-6">
          This is the Zoom App preview endpoint. When launched from within the Zoom client, your app will be displayed
          here.
        </p>

        <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
          <p className="mb-2">
            <strong className="text-blue-400">Status:</strong> Ready for Zoom Apps
          </p>
          <p>
            <strong className="text-green-400">OWASP Headers:</strong> Configured
          </p>
        </div>

        <div className="mt-8 text-xs text-slate-500">
          <p>Built with Bolt.diy</p>
        </div>
      </div>
    </div>
  );
}
