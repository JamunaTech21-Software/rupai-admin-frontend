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

/** P2.07 Leave (RUP-514): the register, asking for leave, the balance refusal, cancelling, and the balances. */

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

async function choose(button: RegExp | string, option: string) {
  await userEvent.click(await screen.findByRole('button', { name: button }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

async function typeDate(label: RegExp, digits: string) {
  const group = await screen.findByRole('group', { name: label });
  await userEvent.click(within(group).getByRole('spinbutton', { name: /month/i }));
  await userEvent.keyboard(digits);
}

/** Fills the form for casual leave between two days (month, day, year digits). */
async function ask(from: string, to: string) {
  await choose(/Leave type/, 'Casual leave');
  await typeDate(/^First day/, from);
  await typeDate(/^Last day/, to);
}

describe('the register', () => {
  it('lists the requests with their status', async () => {
    await openAs('manager', '/hr/leave');
    const table = await screen.findByRole('table', { name: 'Leave' });
    const row = (await within(table).findByRole('link', { name: 'LV-A1' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Salma Begum')).toBeInTheDocument();
    expect(within(row).getByText('Casual leave')).toBeInTheDocument();
    expect(within(row).getByText('Approved')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind leave.view', async () => {
    await openAs('viewer', '/hr/leave');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('asking for leave', () => {
  it('asks for what is missing, keeps a draft and returns to the register', async () => {
    const router = await openAs('manager', '/hr/leave/new');
    await screen.findByRole('heading', { level: 1, name: 'Ask for leave' });
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText('Choose the kind of leave.')).toBeInTheDocument();
    await ask('11022026', '11032026');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/leave');
    });
    const table = await screen.findByRole('table', { name: 'Leave' });
    expect(await within(table).findByText('Draft')).toBeInTheDocument();
  });

  it('refuses a last day before the first, and several days for a half day', async () => {
    await openAs('manager', '/hr/leave/new');
    await screen.findByRole('heading', { level: 1, name: 'Ask for leave' });
    await ask('11052026', '11032026');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('The end cannot be before the start.')).toBeInTheDocument();
    await typeDate(/^Last day/, '11052026');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Half day' }));
    expect(screen.queryByText('A half day needs a single day.')).not.toBeInTheDocument();
  });

  it('sends a request to the supervisor', async () => {
    const router = await openAs('manager', '/hr/leave/new');
    await screen.findByRole('heading', { level: 1, name: 'Ask for leave' });
    await ask('11022026', '11032026');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/leave');
    });
    const table = await screen.findByRole('table', { name: 'Leave' });
    expect(await within(table).findByText('Waiting for approval')).toBeInTheDocument();
  });

  it('shows the balance when the request does not fit, and lets the draft be changed', async () => {
    const router = await openAs('manager', '/hr/leave/new');
    await screen.findByRole('heading', { level: 1, name: 'Ask for leave' });
    await ask('11022026', '11302026');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Not enough leave left')).toBeInTheDocument();
    expect(screen.getByText(/You can ask for 7\.0 days/)).toBeInTheDocument();
    // The request was kept as a draft, where its dates can be changed.
    expect(router.state.location.pathname).toMatch(/^\/hr\/leave\/n\d+$/);
    await typeDate(/^Last day/, '11032026');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/leave');
    });
  });
});

describe('a request', () => {
  it('cancels approved leave with a reason', async () => {
    await openAs('manager', '/hr/leave/a1');
    await screen.findByRole('heading', { level: 1, name: 'LV-A1' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel leave' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel LV-A1' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel leave' }));
    expect(await within(dialog).findByText('Give a reason of at least 3 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Plans changed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel leave' }));
    expect(await screen.findByText('Plans changed')).toBeInTheDocument();
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('deletes a draft', async () => {
    const router = await openAs('manager', '/hr/leave/new');
    await screen.findByRole('heading', { level: 1, name: 'Ask for leave' });
    await ask('11022026', '11032026');
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    const table = await screen.findByRole('table', { name: 'Leave' });
    const link = await within(table).findAllByRole('link', { name: /^LV-N/ });
    await userEvent.click(link[0]!);
    await screen.findByRole('heading', { level: 1, name: /^LV-N/ });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: /^Delete draft/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/leave');
    });
  });
});

describe('the balances', () => {
  it('shows what is entitled, taken and left, and adjusts one', async () => {
    await openAs('manager', '/hr/leave/balances');
    const table = await screen.findByRole('table', { name: 'Leave balances' });
    const row = (await within(table).findByText('Casual leave')).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getAllByText('7.0').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Create the year entitlements' })).toBeDisabled();
    await userEvent.click(within(row).getByRole('button', { name: /^Adjust/ }));
    const dialog = await screen.findByRole('dialog', { name: /^Adjust the leave of/ });
    const days = within(dialog).getByRole('textbox', { name: /^Adjustment/ });
    await userEvent.clear(days);
    await userEvent.type(days, '2');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Long service');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(table).getAllByText('9.0').length).toBeGreaterThan(0);
    });
  });
});

describe('the leave types', () => {
  it('show their yearly days in the masters', async () => {
    await openAs('manager', '/masters/leave-type');
    expect(await screen.findByRole('columnheader', { name: /Days a year/ })).toBeInTheDocument();
  });
});
