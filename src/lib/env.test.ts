import { describe, expect, it } from 'vitest';

import { DEFAULT_API_BASE_URL, readConfig } from './env';

describe('readConfig', () => {
  it('defaults the API base URL to the same-origin path', () => {
    expect(readConfig({}).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(readConfig({ VITE_API_BASE_URL: '  ' }).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });

  it('accepts a path or an absolute URL and strips trailing slashes', () => {
    expect(readConfig({ VITE_API_BASE_URL: '/api/v1/' }).apiBaseUrl).toBe('/api/v1');
    expect(readConfig({ VITE_API_BASE_URL: 'https://staging.example.com/api/v1' }).apiBaseUrl).toBe(
      'https://staging.example.com/api/v1',
    );
  });

  it('refuses a malformed base URL', () => {
    expect(() => readConfig({ VITE_API_BASE_URL: 'api/v1' })).toThrow(/VITE_API_BASE_URL must be/);
  });

  it('reports the Vite mode', () => {
    expect(readConfig({ MODE: 'production' }).mode).toBe('production');
  });
});
