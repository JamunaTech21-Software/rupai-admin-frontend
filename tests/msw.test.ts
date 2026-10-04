import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from './msw/server';

describe('MSW test server', () => {
  it('serves a mocked response in the backend envelope shape', async () => {
    server.use(http.get('http://localhost/health', () => HttpResponse.json({ data: { status: 'ok' } })));
    const response = await fetch('http://localhost/health');
    expect(await response.json()).toEqual({ data: { status: 'ok' } });
  });
});
