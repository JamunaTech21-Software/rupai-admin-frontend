/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. Defaults to `/api/v1` (same origin). See `.env.example`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
