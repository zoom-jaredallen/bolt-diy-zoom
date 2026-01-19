/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Zoom App Client ID (public) */
  readonly VITE_ZOOM_CLIENT_ID: string;

  /** OAuth Redirect URL */
  readonly VITE_OAUTH_REDIRECT_URL: string;

  /** Zoom Project ID for token polling and preview registration */
  readonly ZOOM_PROJECT_ID?: string;
  readonly VITE_ZOOM_PROJECT_ID?: string;

  /** Token polling URL */
  readonly ZOOM_TOKEN_POLLING_URL?: string;

  /** Zoom App Name (for display purposes) */
  readonly VITE_ZOOM_APP_NAME?: string;

  /** bolt.diy base URL (defaults to zoomvibes) */
  readonly ZOOM_BOLT_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
