/**
 * Browser configuration, validated once at start-up. Only `VITE_*` variables reach the bundle, so none of
 * them may hold a secret.
 */
export interface AppConfig {
  /** Base URL of the REST API without a trailing slash: `/api/v1` (same origin) or an absolute http(s) URL. */
  readonly apiBaseUrl: string;
  /** Vite mode: `development`, `production`, `test`, … */
  readonly mode: string;
}

export const DEFAULT_API_BASE_URL = '/api/v1';

type RawEnv = Readonly<Record<string, string | boolean | undefined>>;

/** Reads and validates the configuration. Throws one error listing every problem. */
export function readConfig(env: RawEnv): AppConfig {
  const problems: string[] = [];

  const rawBase = env.VITE_API_BASE_URL;
  let apiBaseUrl =
    typeof rawBase === 'string' && rawBase.trim() !== '' ? rawBase.trim() : DEFAULT_API_BASE_URL;
  if (!apiBaseUrl.startsWith('/') && !/^https?:\/\/[^/\s]+/.test(apiBaseUrl)) {
    problems.push(
      `VITE_API_BASE_URL must be a path starting with "/" or an http(s) URL (got "${apiBaseUrl}").`,
    );
  }
  apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  }

  const mode = typeof env.MODE === 'string' ? env.MODE : 'development';
  return { apiBaseUrl, mode };
}

export const config: AppConfig = readConfig(import.meta.env);
