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

/** P1.01 admin screens (RUP-59): users, a user's roles and effective permissions, roles and their matrix. */

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

describe('users', () => {
  it('lists users with their roles; the search filter lives in the URL', async () => {
    const router = await openAs('manager', '/admin/users');
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    const table = await screen.findByRole('table', { name: 'Users' });
    expect(await within(table).findByRole('link', { name: 'rahim' })).toBeInTheDocument();
    expect(within(table).getByText('Field supervisor')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'adm');
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'rahim' })).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'admin' })).toBeInTheDocument();
    expect(router.state.location.search).toContain('adm');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('creates a user, gives them a role, and shows the permissions that role grants', async () => {
    const router = await openAs('manager', '/admin/users/new');
    await screen.findByRole('heading', { level: 1, name: 'Add user' });
    await userEvent.type(screen.getByRole('textbox', { name: /Username/ }), 'karim');
    await userEvent.type(screen.getByLabelText(/^Temporary password/), 'Long-Enough-Pass-1');
    await userEvent.type(screen.getByLabelText(/^Confirm/), 'Long-Enough-Pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await screen.findByRole('heading', { level: 1, name: 'karim' });
    expect(router.state.location.pathname).toMatch(/^\/admin\/users\/usr_new_/);
    expect(router.state.location.search).toBe('?tab=roles');

    await userEvent.click(screen.getByRole('button', { name: 'Change roles' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Payroll clerk/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('PAYROLL_CLERK')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Permissions' }));
    expect(await screen.findByText(/3 permissions/)).toBeInTheDocument();
  });

  it('a duplicate username is shown on the field', async () => {
    await openAs('manager', '/admin/users/new');
    await screen.findByRole('heading', { level: 1, name: 'Add user' });
    await userEvent.type(screen.getByRole('textbox', { name: /Username/ }), 'rahim');
    await userEvent.type(screen.getByLabelText(/^Temporary password/), 'Long-Enough-Pass-1');
    await userEvent.type(screen.getByLabelText(/^Confirm/), 'Long-Enough-Pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('This username is already taken.')).toBeInTheDocument();
  });
});

describe('roles', () => {
  it('lists roles with their users and permission counts', async () => {
    await openAs('manager', '/admin/roles');
    const table = await screen.findByRole('table', { name: 'Roles & permissions' });
    const admin = (await within(table).findByRole('link', { name: 'Administrator' })).closest('tr');
    expect(admin).not.toBeNull();
    expect(within(admin as HTMLElement).getByText('System')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('a system role: code and permissions are fixed, and it cannot be deleted', async () => {
    await openAs('manager', '/admin/roles/rol_admin');
    await screen.findByRole('heading', { level: 1, name: 'Administrator' });
    expect(screen.getByText(/This is a system role/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Code/ })).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByText(/cannot be deactivated or deleted/)).toBeInTheDocument();
    const matrix = screen.getByRole('region', { name: 'Permissions of Administrator' });
    expect(within(matrix).queryAllByRole('checkbox')).toHaveLength(0);

    // Its name can still change (PATCH, If-Match).
    const name = screen.getByRole('textbox', { name: /^Name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Admin');
    await userEvent.click(screen.getByRole('button', { name: 'Save role' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
  });

  it('creates a custom role from the permission matrix', async () => {
    const router = await openAs('manager', '/admin/roles/new');
    await screen.findByRole('heading', { level: 1, name: 'Add role' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'AUDITOR');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Auditor');

    const matrix = screen.getByRole('region', { name: 'Permissions of Add role' });
    await userEvent.type(within(matrix).getByLabelText('Find a module'), 'audit');
    await userEvent.click(await within(matrix).findByRole('checkbox', { name: /All of Audit/ }));
    expect(within(matrix).getByText('2 of 25 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await screen.findByRole('heading', { level: 1, name: 'Auditor' });
    expect(router.state.location.pathname).toMatch(/^\/admin\/roles\/rol_new_/);
  });

  it('rejects a malformed code before sending', async () => {
    await openAs('manager', '/admin/roles/new');
    await screen.findByRole('heading', { level: 1, name: 'Add role' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'bad code');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Bad');
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText(/Use 2–20 capital letters/)).toBeInTheDocument();
  });

  it('deleting a role still held by users shows the server’s refusal', async () => {
    await openAs('manager', '/admin/roles/rol_supervisor');
    await screen.findByRole('heading', { level: 1, name: 'Field supervisor' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Field supervisor?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/held by users/)).toBeInTheDocument();
  });

  it('a user without role.create is refused the new-role page', async () => {
    await openAs('viewer', '/admin/roles/new');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
