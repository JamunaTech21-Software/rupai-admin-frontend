/**
 * The deployment environment the backend reports in its `X-Environment` response header (development,
 * test, staging). Production sends no header. Read from the liveness endpoint, which needs no sign-in.
 *
 * F0.06's API client will capture the header on every response; until then this one small request is enough.
 */
export async function fetchEnvironment(signal?: AbortSignal): Promise<string | null> {
  const response = await fetch('/health', { method: 'GET', ...(signal ? { signal } : {}) });
  const environment = response.headers.get('X-Environment');
  return environment && environment !== 'production' ? environment : null;
}
