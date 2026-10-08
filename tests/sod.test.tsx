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

/** P1.04 (RUP-107): the separation-of-duties dialog, the Authorisations tab, and the access review. */

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

/** Opens rahim's role picker and ticks the given roles. */
async function pickRoles(...names: RegExp[]) {
  await screen.findByRole('heading', { level: 1, name: 'rahim' });
  await userEvent.click(screen.getByRole('button', { name: 'Change roles' }));
  const picker = await screen.findByRole('dialog', { name: /Roles for rahim/ });
  for (const name of names) {
    await userEvent.click(await within(picker).findByRole('checkbox', { name }));
  }
  await userEvent.click(within(picker).getByRole('button', { name: 'Save changes' }));
}

describe('role assignment', () => {
  it('a conflicting combination asks for a named authorisation, then saves with it', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=roles');
    await pickRoles(/Payroll clerk/, /Payroll approver/);

    const dialog = await screen.findByRole('dialog', { name: 'This change needs an authorisation' });
    expect(within(dialog).getByText('Conflict of duties')).toBeInTheDocument();
    expect(within(dialog).getByText('Create and approve on the same document type')).toBeInTheDocument();
    expect(within(dialog).getByText('payroll.approve')).toBeInTheDocument();
    expect(within(dialog).getByText('payroll.create')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);

    // A reason is required, and must be a real one.
    const reason = within(dialog).getByRole('textbox', { name: /Reason/ });
    await userEvent.type(reason, 'short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Authorise and save' }));
    expect(
      await within(dialog).findByText('Give a real reason (at least 10 characters).'),
    ).toBeInTheDocument();

    await userEvent.clear(reason);
    await userEvent.click(reason);
    await userEvent.paste('Only two clerks at this estate until March.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Authorise and save' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await within(screen.getByRole('tabpanel')).findByText('PAYROLL_APPROVER')).toBeInTheDocument();

    // The authorisation is on the user's record, with the reason.
    await userEvent.click(screen.getByRole('tab', { name: 'Authorisations' }));
    const tab = screen.getByRole('tabpanel');
    expect(await within(tab).findByText('Only two clerks at this estate until March.')).toBeInTheDocument();
    expect(within(tab).getByText('Active')).toBeInTheDocument();
  });

  it('going back returns to the role picker and saves nothing', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=roles');
    await pickRoles(/Payroll clerk/, /Payroll approver/);
    const dialog = await screen.findByRole('dialog', { name: 'This change needs an authorisation' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Go back' }));
    // The choices are still there, ready to change.
    const picker = await screen.findByRole('dialog', { name: /Roles for rahim/ });
    expect(within(picker).getByRole('checkbox', { name: /Payroll approver/ })).toBeChecked();
    await userEvent.click(within(picker).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(within(screen.getByRole('tabpanel')).queryByText('PAYROLL_APPROVER')).not.toBeInTheDocument();
  });

  it('roles that bring no conflict save straight away', async () => {
    await openAs('manager', '/admin/users/usr_rahim?tab=roles');
    await pickRoles(/Payroll approver/);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await within(screen.getByRole('tabpanel')).findByText('PAYROLL_APPROVER')).toBeInTheDocument();
  });
});

describe('role editing', () => {
  it('broadening a role asks for an authorisation for each holder', async () => {
    await openAs('manager', '/admin/roles/rol_supervisor');
    await screen.findByRole('heading', { level: 1, name: 'Field supervisor' });
    const matrix = screen.getByRole('region', { name: 'Permissions of Field supervisor' });
    await userEvent.type(within(matrix).getByLabelText('Find a module'), 'attendance');
    await userEvent.click(await within(matrix).findByRole('checkbox', { name: /^Approve/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save role' }));

    const dialog = await screen.findByRole('dialog', { name: 'This change needs an authorisation' });
    expect(within(dialog).getByText('for rahim')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('textbox', { name: /Reason/ }));
    await userEvent.paste('Supervisor signs off their own muster this season.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Authorise and save' }));
    expect(await screen.findByText('Role saved')).toBeInTheDocument();
  });
});

describe('authorisations tab', () => {
  it('withdraws an authorisation; it stays on record as withdrawn', async () => {
    await openAs('manager', '/admin/users/usr_admin?tab=authorisations');
    const tab = await screen.findByRole('tabpanel');
    const first = (await within(tab).findAllByRole('button', { name: 'Withdraw' }))[0];
    expect(first).toBeDefined();
    const before = within(tab).getAllByRole('button', { name: 'Withdraw' }).length;
    await userEvent.click(first!);
    const confirm = await screen.findByRole('alertdialog', { name: 'Withdraw this authorisation?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => {
      expect(within(tab).getAllByRole('button', { name: 'Withdraw' })).toHaveLength(before - 1);
    });
    expect(within(tab).getByText('Withdrawn')).toBeInTheDocument();
  });
});

describe('access review', () => {
  it('shows what is not authorised first, then the full picture', async () => {
    await openAs('manager', '/admin/access-review');
    await screen.findByRole('heading', { level: 1, name: 'Access review' });
    const unauthorised = await screen.findByRole('region', { name: /Not authorised/ });
    expect(within(unauthorised).getByRole('link', { name: 'Review admin' })).toHaveAttribute(
      'href',
      '/admin/users/usr_admin?tab=roles',
    );
    expect(within(unauthorised).getByText('Sensitive permission payroll.post')).toBeInTheDocument();

    expect(screen.getByRole('region', { name: 'Active authorisations' })).toHaveTextContent(
      'Accepted at installation.',
    );
    const sensitive = screen.getByRole('region', { name: 'Sensitive permissions' });
    expect(within(sensitive).getByText('payroll.post')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Approve and post in the same area' })).toHaveTextContent(
      'payroll',
    );
    expect(screen.getByRole('region', { name: 'Separation-of-duties rules' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is in the sidebar under Administration', async () => {
    await openAs('manager', '/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Access review' })).toHaveAttribute(
      'href',
      '/admin/access-review',
    );
  });

  it('needs user.view', async () => {
    await openAs('viewer', '/admin/access-review');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
