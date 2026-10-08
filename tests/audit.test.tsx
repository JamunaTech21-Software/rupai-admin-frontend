import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { adminMocks, resetAdminMocks } from '@/features/admin/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.05 (RUP-123): Admin → Audit (changes and access log) and a record's History panel. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetAdminMocks();
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

describe('changes', () => {
  it('lists the last 7 days of changes, field by field, newest first', async () => {
    await openAs('manager', '/admin/audit');
    await screen.findByRole('heading', { level: 1, name: 'Audit log' });
    const table = await screen.findByRole('table', { name: 'Changes' });
    expect(await within(table).findByText('rahim@example.com')).toBeInTheDocument();
    expect(within(table).getByText('rahim@old.example.com')).toBeInTheDocument();
    // The user it is about links to their page.
    expect(within(table).getAllByRole('link', { name: 'User #usr_rahim' })[0]).toHaveAttribute(
      'href',
      '/admin/users/usr_rahim',
    );
    // 20 days ago is outside the default window.
    expect(within(table).queryByText('Role #rol_clerk')).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters by record type, in the URL', async () => {
    const router = await openAs('manager', '/admin/audit');
    const table = await screen.findByRole('table', { name: 'Changes' });
    await within(table).findByText('rahim@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Any record/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Role' }));
    await waitFor(() => {
      expect(within(table).queryByText('rahim@example.com')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Field supervisor')).toBeInTheDocument();
    expect(router.state.location.search).toContain('filter%5Brecord_type%5D=role');
  });

  it('a snapshot shows in full on request', async () => {
    await openAs('manager', '/admin/audit');
    const table = await screen.findByRole('table', { name: 'Changes' });
    await within(table).findByText('rahim@example.com');
    // The oldest row in the window is the user's creation snapshot.
    const showAll = within(table).getAllByRole('button', { name: 'Show all' });
    await userEvent.click(showAll[showAll.length - 1]!);
    expect(within(table).getByText(/"username": "rahim"/)).toBeInTheDocument();
  });
});

describe('access log', () => {
  it('highlights security events, and can show only those', async () => {
    const router = await openAs('manager', '/admin/audit');
    await userEvent.click(await screen.findByRole('tab', { name: 'Access log' }));
    const table = await screen.findByRole('table', { name: 'Access log' });
    expect(await within(table).findByText('Permission denied')).toBeInTheDocument();
    expect(within(table).getByText('Failed sign-in')).toBeInTheDocument();
    expect(within(table).getByRole('img', { name: 'Security event' })).toBeInTheDocument();
    expect(within(table).getByText('Unknown user')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Any event/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Security events only' }));
    await waitFor(() => {
      expect(within(table).queryByText('Failed sign-in')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Permission denied')).toBeInTheDocument();
    expect(router.state.location.search).toContain('filter%5Bevent_type%5D%5Bin%5D=');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('switching tabs starts the other tab without the first one’s filters', async () => {
    const router = await openAs('manager', '/admin/audit?filter[record_type]=role');
    await screen.findByRole('table', { name: 'Changes' });
    await userEvent.click(screen.getByRole('tab', { name: 'Access log' }));
    await screen.findByRole('table', { name: 'Access log' });
    expect(router.state.location.search).toBe('?tab=access');
  });
});

describe('record history', () => {
  it('a user page shows the user’s changes and status on one timeline', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=history');
    const panel = await screen.findByRole('tabpanel');
    const timeline = await within(panel).findByRole('list', { name: 'History' });
    expect(within(timeline).getByText('Email changed')).toBeInTheDocument();
    expect(within(timeline).getByText('Status: active')).toBeInTheDocument();
    expect(within(timeline).getByText('Created')).toBeInTheDocument();
  });

  it('a role page has a History section', async () => {
    await openAs('manager', '/admin/roles/rol_supervisor');
    const section = await screen.findByRole('region', { name: 'History' });
    expect(await within(section).findByText('Name changed')).toBeInTheDocument();
  });
});

describe('permissions', () => {
  it('needs audit.view', async () => {
    await openAs('viewer', '/admin/audit');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
