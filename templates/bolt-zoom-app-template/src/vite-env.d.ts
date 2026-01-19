/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Zoom App Client ID (public) */
  readonly VITE_ZOOM_CLIENT_ID: string;

  /** OAuth Redirect URL */
  readonly VITE_OAUTH_REDIRECT_URL: string;

  /** Zoom Project ID for token polling */
  readonly ZOOM_PROJECT_ID?: string;
  readonly VITE_ZOOM_PROJECT_ID?: string;

  /** Token polling URL */
  readonly ZOOM_TOKEN_POLLING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
