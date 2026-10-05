/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. Defaults to `/api/v1` (same origin). See `.env.example`. */
  readonly VITE_API_BASE_URL?: string;
  /** Which features answer from MSW mocks in development: none | all | a comma-separated list. */
  readonly VITE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
