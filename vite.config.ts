import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Local development talks to the backend through this proxy, so the browser sees one origin (no CORS).
  const fromEnv = env.VITE_API_PROXY_TARGET?.trim();
  const proxyTarget = fromEnv !== undefined && fromEnv !== '' ? fromEnv : 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
        // The API documentation (Swagger UI), as Vercel rewrites it on staging.
        '/docs': { target: proxyTarget, changeOrigin: true },
      },
    },
    build: {
      // The manifest feeds the bundle-size budget check (scripts/check-bundle-size.mjs).
      manifest: true,
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      // Node's fetch needs absolute URLs: in tests the API lives at http://localhost/api/v1 (MSW answers it).
      env: { VITE_API_BASE_URL: 'http://localhost/api/v1' },
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'eslint-rules/**/*.test.js'],
      restoreMocks: true,
      // The token reference renders ~100 tokens and axe walks all of it: allow for a busy machine.
      testTimeout: 20_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/app/main.tsx'],
      },
    },
  };
});
