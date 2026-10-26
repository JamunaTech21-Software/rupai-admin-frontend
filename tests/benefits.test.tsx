import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { organisationMocks, resetOrganisationMocks } from '@/features/organisation/api/mocks';
import { referenceMocks } from '@/features/reference/api/mocks';
import { resetWorkforceMocks, workforceMocks } from '@/features/workforce/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P2.08 Benefits & welfare (RUP-530): entitlements, issues, and welfare cases with their approval state. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetOrganisationMocks();
  resetWorkforceMocks();
  setAccessToken(null);
  server.use(
    ...authMocks(BASE),
    ...organisationMocks(BASE),
    ...workforceMocks(BASE),
    ...referenceMocks(BASE),
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

describe('benefits', () => {
  it('lists the entitlements with their state', async () => {
    await openAs('manager', '/hr/benefits');
    const table = await screen.findByRole('table', { name: 'Entitlements' });
    const row = (await within(table).findByText('RC-1001')).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getAllByText('Salma Begum').length).toBeGreaterThan(0);
    expect(within(row).getByText('Approved')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind benefit.view', async () => {
    await openAs('viewer', '/hr/benefits');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });

  it('asks for what is missing before an entitlement is added', async () => {
    await openAs('manager', '/hr/benefits');
    await userEvent.click(await screen.findByRole('button', { name: 'Add entitlement' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add entitlement' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    expect(await within(dialog).findByText('Choose the benefit.')).toBeInTheDocument();
  });

  it('asks for the benefit, estate and date before issues are generated', async () => {
    await openAs('manager', '/hr/benefits?tab=issues');
    await userEvent.click(await screen.findByRole('button', { name: 'Generate issues' }));
    const dialog = await screen.findByRole('dialog', { name: 'Generate issues' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generate' }));
    expect(await within(dialog).findByText('Choose the benefit.')).toBeInTheDocument();
  });
});

describe('welfare cases', () => {
  it('lists the cases with their state and money', async () => {
    await openAs('manager', '/hr/welfare');
    const table = await screen.findByRole('table', { name: 'Welfare' });
    const row = (await within(table).findByRole('link', { name: 'WC-W2' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Education')).toBeInTheDocument();
    expect(within(row).getByText('Approved')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind welfare.view', async () => {
    await openAs('viewer', '/hr/welfare');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });

  it('asks for what is missing, then keeps a draft and returns to the list', async () => {
    const router = await openAs('manager', '/hr/welfare/new');
    await screen.findByRole('heading', { level: 1, name: 'Open welfare case' });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Describe the need in at least 3 characters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /An employee or worker/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'The community' }));
    await userEvent.click(screen.getByRole('button', { name: /^Select/ }));
    await userEvent.click((await screen.findAllByRole('option'))[1]!);
    await userEvent.type(screen.getByRole('textbox', { name: /What happened/ }), 'Flood repairs');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/welfare');
    });
  });

  it('needs the amount asked before it is sent for approval', async () => {
    await openAs('manager', '/hr/welfare/w1');
    await screen.findByRole('heading', { level: 1, name: 'WC-W1' });
    await userEvent.clear(screen.getByRole('textbox', { name: /Amount asked/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    expect(
      await screen.findByText('Enter the amount asked before sending it for approval.'),
    ).toBeInTheDocument();
  });

  it('deletes a draft and returns to the list', async () => {
    const router = await openAs('manager', '/hr/welfare/w1');
    await screen.findByRole('heading', { level: 1, name: 'WC-W1' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete case WC-W1?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/welfare');
    });
  });

  it('records a payment up to what remains and refuses more', async () => {
    await openAs('manager', '/hr/welfare/w2');
    await screen.findByRole('heading', { level: 1, name: 'WC-W2' });
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record a payment for WC-W2' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await within(dialog).findByText('Enter an amount above zero.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Amount paid/ }), '99999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await within(dialog).findByText(/At most/)).toBeInTheDocument();
    const amount = within(dialog).getByRole('textbox', { name: /Amount paid/ });
    await userEvent.clear(amount);
    await userEvent.type(amount, '4000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Record a payment for WC-W2' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Paid so far')).toBeInTheDocument();
  });

  it('closes an approved case with its outcome', async () => {
    await openAs('manager', '/hr/welfare/w2');
    await screen.findByRole('heading', { level: 1, name: 'WC-W2' });
    await userEvent.click(screen.getByRole('button', { name: 'Close case' }));
    const dialog = await screen.findByRole('dialog', { name: 'Close case WC-W2' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Outcome/ }), 'Fees paid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close case' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Close case WC-W2' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Fees paid')).toBeInTheDocument();
  });
});
