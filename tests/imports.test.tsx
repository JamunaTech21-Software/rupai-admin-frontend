import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { importMocks, resetImportMocks, uploadResponse } from '@/features/imports/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.17 (RUP-309): the import wizard: template, upload, validation, error report, confirm, result, history. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetImportMocks();
  setAccessToken(null);
  server.use(...importMocks(BASE), ...authMocks(BASE));
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

const csv = (text: string, name = 'amenities.csv') => new File([text], name, { type: 'text/csv' });

/** Choose the kind, attach a file and upload it; the wizard moves to the batch's own page. */
async function upload(file: File) {
  const router = await openAs('manager', '/imports/new?type=lookup.amenity');
  await screen.findByRole('heading', { level: 1, name: 'Import Amenities' });
  // The file picker's input is hidden; the visible button opens it.
  await screen.findByRole('button', { name: 'Upload and check' });
  const input = appRoot.querySelector('input[type=file]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
  await userEvent.upload(input, file);
  await userEvent.click(screen.getByRole('button', { name: 'Upload and check' }));
  await waitFor(() => {
    expect(router.state.location.pathname).toMatch(/^\/imports\/imp_/);
  });
  return router;
}

describe('step 1: choose and take the template', () => {
  it('lists the columns of the kind and offers the template in both formats', async () => {
    await openAs('manager', '/imports/new?type=lookup.amenity');
    await screen.findByRole('heading', { level: 1, name: 'Import Amenities' });
    const table = await screen.findByRole('table', { name: 'Columns of the Amenities file' });
    expect(within(table).getByText('CRECHE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Template as XLSX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Template as CSV' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('asks which kind first when none is chosen', async () => {
    await openAs('manager', '/imports/new');
    await screen.findByRole('heading', { level: 1, name: 'New import' });
    await userEvent.click(await screen.findByRole('button', { name: /What to import/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Soil types' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Import Soil types' })).toBeInTheDocument();
  });

  it('wants a file before it uploads', async () => {
    await openAs('manager', '/imports/new?type=lookup.amenity');
    await userEvent.click(await screen.findByRole('button', { name: 'Upload and check' }));
    expect(await screen.findByText('Choose the file to upload.')).toBeInTheDocument();
  });
});

describe('steps 3 to 7: validate, read the errors, confirm, result', () => {
  it('checks the file, shows the good and bad rows, and saves only the good ones', async () => {
    await upload(csv('code,name\nCRECHE,Creche\n,Nameless\nCLUB,Club\nCLUB,Club again\n'));
    await screen.findByRole('heading', { level: 1, name: 'Amenities' });
    // It starts out being checked, then settles on its own.
    expect(await screen.findByText('Checked', {}, { timeout: 10_000 })).toBeInTheDocument();
    const counts = screen.getByRole('region', { name: 'What was found' });
    expect(within(counts).getByText('Good rows').parentElement).toHaveTextContent('2');
    expect(within(counts).getByText('Rows with errors').parentElement).toHaveTextContent('2');

    // The report: the header is row 1, so data starts at row 2.
    const report = await screen.findByRole('table', { name: 'Errors found' });
    expect(within(report).getByText('Code is required.')).toBeInTheDocument();
    expect(within(report).getByText('DUPLICATE_KEY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Error report as XLSX' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Import 2 valid rows?' });
    expect(within(confirm).getByText(/2 rows with errors will be skipped/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Saving started')).toBeInTheDocument();
    expect(await screen.findByText('2 rows saved', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
  }, 60_000);

  it('refuses a file without the required column and says which', async () => {
    await upload(csv('name\nCreche\n'));
    expect(
      await screen.findByText('The file could not be used', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Column code is required.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload another file' })).toHaveAttribute(
      'href',
      '/imports/new?type=lookup.amenity',
    );
  }, 60_000);

  it('offers no import when every row is bad', async () => {
    await upload(csv('code,name\n,One\n,Two\n'));
    expect(
      await screen.findByText('Nothing can be saved from this file', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
  }, 60_000);

  it('cancels a checked import: nothing is saved', async () => {
    await upload(csv('code,name\nCRECHE,Creche\n'));
    await screen.findByText('Checked', {}, { timeout: 10_000 });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Cancel the import of amenities.csv?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel import' }));
    expect(await screen.findByText('This import was cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
  }, 60_000);

  it('answers not found for a batch that is not there', async () => {
    await openAs('manager', '/imports/nobody');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('history', () => {
  it('lists the imports, newest first, and filters by state', async () => {
    const router = await upload(csv('code,name\nCRECHE,Creche\n'));
    await screen.findByText('Checked', {}, { timeout: 10_000 });
    void router.navigate('/imports');
    await screen.findByRole('heading', { level: 1, name: 'Imports' });
    const table = await screen.findByRole('table', { name: 'Imports' });
    expect(await within(table).findByText('amenities.csv')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /State$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Saved' }));
    await waitFor(() => {
      expect(within(table).queryByText('amenities.csv')).not.toBeInTheDocument();
    });
  }, 60_000);

  it('is empty before the first import', async () => {
    await openAs('manager', '/imports');
    expect(await screen.findByText('No imports yet')).toBeInTheDocument();
  });
});

describe('the Import button on a list', () => {
  it('shows on a master the server offers an import for, and opens the wizard on it', async () => {
    await openAs('manager', '/masters/amenity');
    const link = await screen.findByRole('link', { name: 'Import from file' }, { timeout: 10_000 });
    expect(link).toHaveAttribute('href', '/imports/new?type=lookup.amenity');
  }, 60_000);
});
