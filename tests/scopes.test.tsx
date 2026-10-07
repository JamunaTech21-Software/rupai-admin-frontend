import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { adminMocks, resetAdminMocks } from '@/features/admin/api/mocks';
import { setAccessToken } from '@/lib/api';
import { resetEstateContext } from '@/lib/auth';
import { authMocks, MOCK_PASSWORD, mockSession, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.03 data scope (RUP-91): the Scopes tab on a user, and the estate selector in the top bar. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetAdminMocks();
  resetEstateContext();
  window.localStorage.clear();
  setAccessToken(null);
  server.use(...authMocks(BASE), ...adminMocks(BASE));
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

async function scopeList() {
  return screen.findByRole('list', { name: 'Scope grants' });
}

describe('scopes tab', () => {
  it('lists active grants first and greys out an expired one', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=scopes');
    const list = await scopeList();
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Estate 3'),
      expect.stringContaining('Division 12'),
    ]);
    expect(within(rows[1]!).getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText(/1 active grant./)).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('grants an estate scope, and shows a duplicate on the field', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=scopes');
    await scopeList();

    await userEvent.click(screen.getByRole('button', { name: 'Grant scope' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Estate number/ }), '9');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant scope' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await within(await scopeList()).findByText('Estate 9')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Grant scope' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Estate number/ }), '3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant scope' }));
    expect(
      await within(dialog).findByText('Change the existing grant’s expiry instead.'),
    ).toBeInTheDocument();
  });

  it('checks the record number before sending', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=scopes');
    await scopeList();
    await userEvent.click(screen.getByRole('button', { name: 'Grant scope' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Estate number/ }), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant scope' }));
    expect(await within(dialog).findByText('Enter the record number, e.g. 12.')).toBeInTheDocument();
  });

  it('removing an expiry makes a lapsed grant active again (sent with If-Match)', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=scopes');
    const list = await scopeList();
    const lapsed = within(list).getAllByRole('listitem')[1]!;
    await userEvent.click(within(lapsed).getByRole('button', { name: 'Expiry' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/2 active grants/)).toBeInTheDocument();
  });

  it('revokes a grant after confirmation', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=scopes');
    const list = await scopeList();
    const first = within(list).getAllByRole('listitem')[0]!;
    await userEvent.click(within(first).getByRole('button', { name: 'Revoke' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Revoke Estate 3 from rahim?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(screen.queryByText('Estate 3')).not.toBeInTheDocument();
    });
  });

  it('a user with only user.view sees the grants but cannot change them', async () => {
    mockSession.passwordChanged.add('usr_trainee');
    await openAs('trainee', '/admin/users/usr_rahim?tab=scopes');
    await scopeList();
    expect(screen.queryByRole('button', { name: 'Grant scope' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('an unknown or out-of-scope user shows the not-found state', async () => {
    await openAs('manager', '/admin/users/usr_nobody?tab=scopes');
    expect(await screen.findByRole('heading', { name: /not found|does not exist/i })).toBeInTheDocument();
  });
});

describe('estate selector', () => {
  it('an unrestricted user sees "All estates" with nothing to switch', async () => {
    await openAs('manager', '/');
    expect(await screen.findByRole('img', { name: 'Estate: All estates' })).toBeInTheDocument();
  });

  it('a user scoped to two estates narrows to one, and the choice is remembered', async () => {
    await openAs('viewer', '/');
    const button = await screen.findByRole('button', { name: 'Estate: All my estates' });
    await userEvent.click(button);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['All my estates', 'Estate 3', 'Estate 7']);
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Estate 7' }));
    expect(await screen.findByRole('button', { name: 'Estate: Estate 7' })).toBeInTheDocument();
    expect(window.localStorage.getItem('rupai.estate.usr_viewer')).toBe('7');
    expect(await axeViolations(appRoot)).toEqual([]);
  });
});
