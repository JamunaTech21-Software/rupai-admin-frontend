import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { importMocks, resetImportMocks, uploadResponse } from '@/features/imports/api/mocks';
import { organisationMocks, resetOrganisationMocks } from '@/features/organisation/api/mocks';
import { referenceMocks } from '@/features/reference/api/mocks';
import { resetWorkforceMocks, workforceMocks } from '@/features/workforce/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { server } from './msw/server';

/** P2.06 Workforce bulk import (RUP-498): the Import buttons of the lists, and the rule for files that set salaries. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetImportMocks();
  resetOrganisationMocks();
  resetWorkforceMocks();
  setAccessToken(null);
  server.use(
    ...importMocks(BASE),
    ...authMocks(BASE),
    ...organisationMocks(BASE),
    ...workforceMocks(BASE),
    ...referenceMocks(BASE),
  );
  // jsdom's FormData cannot travel through Node's fetch, so the multipart upload is answered here.
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.body instanceof FormData) {
      const file = init.body.get('file');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const type = /\/imports\/([^/?]+)$/.exec(url)?.[1] ?? '';
      return uploadResponse(type, file instanceof File ? file : null);
    }
    return realFetch(input, init);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

let appRoot: HTMLElement = document.body;

async function openAs(username: string, path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  appRoot = render(<RouterProvider router={router} />).container;
  await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), username);
  await userEvent.type(screen.getByLabelText(/^Password/), MOCK_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  return router;
}

describe('the Import buttons', () => {
  it.each([
    ['/workforce/workers', 'workforce.worker'],
    ['/workforce/employees', 'workforce.employee'],
    ['/workforce/contractors', 'workforce.contractor'],
  ])('%s opens the wizard on its kind of file', async (path, type) => {
    await openAs('manager', path);
    const link = await screen.findByRole('link', { name: 'Import from file' });
    expect(link).toHaveAttribute('href', `/imports/new?type=${type}`);
  });
});

describe('a file that sets salaries', () => {
  it('cannot be committed by the person who uploaded it, and says who must', async () => {
    const router = await openAs('manager', '/imports/new?type=workforce.employee');
    await screen.findByRole('heading', { level: 1, name: 'Import Employees' });
    await screen.findByRole('button', { name: 'Upload and check' });
    const input = appRoot.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
    await userEvent.upload(
      input,
      new File(['estate,first_name,basic_salary\nDEMO-A,Karim,15000\n'], 'employees.csv', {
        type: 'text/csv',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload and check' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/imports\/imp_/);
    });
    expect(
      await screen.findByText('Salary lines in this file', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /^Import 1 row/ }, { timeout: 4000 }));
    const confirm = await screen.findByRole('alertdialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Send to an approver to commit')).toBeInTheDocument();
    expect(screen.getByText(/you cannot commit a file you uploaded/)).toBeInTheDocument();
  });
});
