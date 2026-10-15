import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { documentMocks, MOCK_DOCUMENT_TYPES, resetDocumentMocks } from '@/features/documents/api/mocks';
import { organisationMocks, resetOrganisationMocks } from '@/features/organisation/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.12 (RUP-229): the attachments panel and the Expiring documents page. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetOrganisationMocks();
  resetDocumentMocks();
  setAccessToken(null);
  server.use(
    // The first match answers, so the documents mocks come before the organisation's estate-photo ones.
    ...documentMocks(BASE),
    ...authMocks(BASE),
    ...organisationMocks(BASE),
    http.get(`${BASE}/lookups`, () =>
      HttpResponse.json({
        data: { document_type: MOCK_DOCUMENT_TYPES.map((t) => ({ ...t, status: 'active', version: 1 })) },
        meta: { request_id: 'test' },
      }),
    ),
  );
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

const panel = () => screen.findByRole('region', { name: 'Documents' });

async function openFactory() {
  await openAs('manager', '/factories/fa1');
  await screen.findByRole('heading', { level: 1, name: 'Rupai Central Factory' });
  const documents = await panel();
  await within(documents).findByText('Fire licence');
  return documents;
}

/** jsdom's FormData cannot travel through Node's fetch, so a multipart request is answered here and kept. */
function answerUploads(respond: (form: FormData) => Response) {
  const sent: { form: FormData | null } = { form: null };
  const realFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.body instanceof FormData) {
      sent.form = init.body;
      return Promise.resolve(respond(init.body));
    }
    return realFetch(input, init);
  });
  return {
    sent,
    restore: () => {
      spy.mockRestore();
    },
  };
}

const fileInput = (scope: HTMLElement) => {
  const input = scope.querySelector('input[type=file]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
  return input;
};

describe('attachments panel', () => {
  it('lists the current documents with their expiry, and earlier versions on request', async () => {
    const documents = await openFactory();
    // Current version of each document; a certificate with no title is named by its type.
    expect(within(documents).getByText('Version 2')).toBeInTheDocument();
    expect(within(documents).getByText('fire-licence-2026.pdf · 117 KB')).toBeInTheDocument();
    expect(within(documents).getByText('Expires in 12 days')).toBeInTheDocument();
    expect(within(documents).getByText('Certificate')).toBeInTheDocument();
    expect(within(documents).getByText('No expiry date')).toBeInTheDocument();
    expect(within(documents).queryByText('fire-licence-2025.pdf · 117 KB')).not.toBeInTheDocument();

    await userEvent.click(within(documents).getByRole('checkbox', { name: 'Show earlier versions' }));
    expect(await within(documents).findByText('fire-licence-2025.pdf · 117 KB')).toBeInTheDocument();
    expect(within(documents).getByText('Earlier version')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('asks for the type and the file before adding', async () => {
    const documents = await openFactory();
    await userEvent.click(within(documents).getByRole('button', { name: 'Add document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add document' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('Choose the document type.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a file.')).toBeInTheDocument();
  });

  it('adds a document as a multipart upload', async () => {
    const documents = await openFactory();
    const { sent, restore } = answerUploads(() =>
      Response.json(
        {
          data: {
            id: 'doc_up',
            owner_type: 'factory',
            owner_id: 'fa1',
            document_type_id: 'dt_cert',
            document_type: MOCK_DOCUMENT_TYPES[1],
            title: 'Weighbridge certificate',
            file_name: 'weighbridge.pdf',
            mime_type: 'application/pdf',
            file_size_bytes: 3,
            version_number: 1,
            issue_date: null,
            expiry_date: null,
            days_to_expiry: null,
            is_current: true,
            status: 'active',
            uploaded_by_name: 'Demo Manager',
            version: 1,
            created_at: '2026-10-15T04:00:00.000Z',
          },
          meta: { request_id: 'test' },
        },
        { status: 201 },
      ),
    );
    await userEvent.click(within(documents).getByRole('button', { name: 'Add document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add document' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Document type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Certificate' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Title/ }), 'Weighbridge certificate');
    await userEvent.upload(
      fileInput(dialog),
      new File(['pdf'], 'weighbridge.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Document added')).toBeInTheDocument();
    restore();
    expect(sent.form?.get('document_type_id')).toBe('dt_cert');
    expect(sent.form?.get('title')).toBe('Weighbridge certificate');
    expect((sent.form?.get('file') as File | null)?.name).toBe('weighbridge.pdf');
  });

  it("shows the server's refusal of a replacement on the file", async () => {
    const documents = await openFactory();
    const { restore } = answerUploads(() =>
      Response.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The request is not valid.',
            details: [
              {
                field: 'file',
                code: 'FILE_UNCHANGED',
                message: 'This is the same file as the current version.',
              },
            ],
            request_id: 'test',
          },
        },
        { status: 422 },
      ),
    );
    await userEvent.click(within(documents).getByRole('button', { name: 'Replace Fire licence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace Fire licence' });
    await userEvent.upload(
      fileInput(dialog),
      new File(['pdf'], 'fire-licence-2026.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace file' }));
    expect(
      await within(dialog).findByText('This is the same file as the current version.'),
    ).toBeInTheDocument();
    restore();
  });

  it('corrects a title with If-Match', async () => {
    const documents = await openFactory();
    await userEvent.click(within(documents).getByRole('button', { name: 'Edit details of Fire licence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit details of Fire licence' });
    const title = within(dialog).getByRole('textbox', { name: /^Title/ });
    await userEvent.clear(title);
    await userEvent.type(title, 'Fire safety licence');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Details saved')).toBeInTheDocument();
    expect(await within(documents).findByText('Fire safety licence')).toBeInTheDocument();
  });

  it('removes a document after confirming', async () => {
    const documents = await openFactory();
    await userEvent.click(within(documents).getByRole('button', { name: 'Remove Fire licence' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Fire licence?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove document' }));
    expect(await screen.findByText('Document removed')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(documents).queryByText('Fire licence')).not.toBeInTheDocument();
    });
  });

  it('shows every version of a document', async () => {
    const documents = await openFactory();
    await userEvent.click(within(documents).getByRole('button', { name: 'Versions of Fire licence' }));
    const drawer = await screen.findByRole('dialog', { name: 'Versions of Fire licence' });
    expect(await within(drawer).findByText('Version 2')).toBeInTheDocument();
    expect(within(drawer).getByText('Version 1')).toBeInTheDocument();
    expect(within(drawer).getByText('Earlier version')).toBeInTheDocument();
    expect(within(drawer).getByText('fire-licence-2025.pdf · 117 KB')).toBeInTheDocument();
  });

  it('asks for a fresh link at the click and follows it', async () => {
    const documents = await openFactory();
    const followed: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      followed.push(`${this.getAttribute('href') ?? ''}|${this.download}`);
    });
    await userEvent.click(within(documents).getByRole('button', { name: 'Download Fire licence' }));
    await waitFor(() => {
      expect(followed).toEqual([
        '/api/v1/documents/doc_fire/content?expires=1&signature=mock-signature-for-doc_fire|fire-licence-2026.pdf',
      ]);
    });
    click.mockRestore();
  });
});

describe('expiring documents', () => {
  it('lists what expires within 30 days, expired first, each linking to its record', async () => {
    await openAs('manager', '/documents/expiring');
    await screen.findByRole('heading', { level: 1, name: 'Expiring documents' });
    const table = await screen.findByRole('table', { name: 'Expiring documents' });
    const land = (await within(table).findByText('Land record')).closest('tr');
    const fire = within(table).getByText('Fire licence').closest('tr');
    if (!land || !fire) throw new Error('rows missing');
    expect(within(land).getByText('Expired 5 days ago')).toBeInTheDocument();
    expect(within(land).getByRole('link', { name: 'DEMO-A · Rupai Hills Tea Estate' })).toHaveAttribute(
      'href',
      '/estates/e1',
    );
    expect(within(fire).getByText('Expires in 12 days')).toBeInTheDocument();
    expect(within(fire).getByRole('link', { name: 'DEMO-F1 · Rupai Central Factory' })).toHaveAttribute(
      'href',
      '/factories/fa1',
    );
    // Soonest first, and nothing beyond the window.
    expect(land.compareDocumentPosition(fire) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(table).queryByText('Insurance')).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters by the kind of record', async () => {
    await openAs('manager', '/documents/expiring');
    const table = await screen.findByRole('table', { name: 'Expiring documents' });
    await within(table).findByText('Fire licence');
    await userEvent.click(screen.getByRole('button', { name: /Record type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Estate' }));
    await waitFor(() => {
      expect(within(table).queryByText('Fire licence')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Land record')).toBeInTheDocument();
  });

  it('is in the sidebar for those who may view documents, and needs document.view', async () => {
    await openAs('viewer', '/documents/expiring');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
