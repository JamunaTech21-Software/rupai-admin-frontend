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

/** P2.04 Worker teams (RUP-466): the list, the details, and who is in a team and when. */

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

async function choose(scope: HTMLElement, button: RegExp | string, option: string) {
  await userEvent.click(await within(scope).findByRole('button', { name: button }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('teams list', () => {
  it('lists the teams with their leader and members today', async () => {
    await openAs('manager', '/workforce/teams');
    const table = await screen.findByRole('table', { name: 'Teams' });
    const row = (await within(table).findByRole('link', { name: 'PG-NORTH' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Plucking Gang North')).toBeInTheDocument();
    expect(within(row).getByText('Salma Begum')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters by type', async () => {
    await openAs('manager', '/workforce/teams');
    const table = await screen.findByRole('table', { name: 'Teams' });
    await within(table).findByRole('link', { name: 'PG-NORTH' });
    await userEvent.click(screen.getByRole('button', { name: /Type$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Field' }));
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'PG-NORTH' })).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'FT-SOUTH' })).toBeInTheDocument();
  });

  it('is behind team.view', async () => {
    await openAs('viewer', '/workforce/teams');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('team form', () => {
  it('adds a team and returns to the list; a duplicate code is shown on the field', async () => {
    const router = await openAs('manager', '/workforce/teams/new');
    await screen.findByRole('heading', { level: 1, name: 'Add team' });
    await userEvent.click(screen.getByRole('button', { name: 'Save team' }));
    expect(await screen.findByText('Enter the team code.')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Garden/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'DEMO-A · Rupai Hills Tea Estate' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'PG-NORTH');
    await userEvent.type(screen.getByRole('textbox', { name: /^Team name/ }), 'Duplicate');
    await userEvent.click(screen.getByRole('button', { name: 'Save team' }));
    expect(await screen.findByText('Another team of this estate has this code.')).toBeInTheDocument();
    const code = screen.getByRole('textbox', { name: /^Code/ });
    await userEvent.clear(code);
    await userEvent.type(code, 'NEW-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save team' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/teams');
    });
    const table = await screen.findByRole('table', { name: 'Teams' });
    expect(await within(table).findByRole('link', { name: 'NEW-1' })).toBeInTheDocument();
  });

  it('saves a change and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/teams/t1?tab=details');
    await screen.findByRole('heading', { level: 1, name: 'Plucking Gang North' });
    const name = await screen.findByRole('textbox', { name: /^Team name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Gang North');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/teams');
    });
  });
});

describe('members', () => {
  it('shows the members today, leader first, and the history', async () => {
    await openAs('manager', '/workforce/teams/t1');
    await screen.findByRole('heading', { level: 1, name: 'Plucking Gang North' });
    const table = await screen.findByRole('table', { name: 'Members' });
    expect(await within(table).findByRole('rowheader', { name: 'Salma Begum' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /Role of Salma Begum/ })).toHaveTextContent('Leader');
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByRole('table', { name: 'Membership history' })).toBeInTheDocument();
  });

  it('adds a worker, and moves one who is in another team', async () => {
    await openAs('manager', '/workforce/teams/t3');
    await screen.findByRole('heading', { level: 1, name: 'Empty Team' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add workers' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: /Workers/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Jalal Mia (WRK-A-0002)' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add workers' }));
    expect(await within(dialog).findByText('Already in another team')).toBeInTheDocument();
    expect(within(dialog).getByText('Jalal Mia is in Field Team South.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move them to this team' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const table = await screen.findByRole('table', { name: 'Members' });
    expect(await within(table).findByRole('rowheader', { name: 'Jalal Mia' })).toBeInTheDocument();
  });

  it('ends a membership with a last day', async () => {
    await openAs('manager', '/workforce/teams/t2');
    const table = await screen.findByRole('table', { name: 'Members' });
    await within(table).findByRole('rowheader', { name: 'Jalal Mia' });
    await userEvent.click(within(table).getByRole('button', { name: /^End/ }));
    const dialog = await screen.findByRole('dialog', { name: 'End the membership of Jalal Mia' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'End' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await within(table).findByText('25 Oct 2026')).toBeInTheDocument();
  });

  it('changes a role', async () => {
    await openAs('manager', '/workforce/teams/t2');
    const table = await screen.findByRole('table', { name: 'Members' });
    await within(table).findByRole('rowheader', { name: 'Jalal Mia' });
    await choose(table, /Role of Jalal Mia/, 'Leader');
    await waitFor(() => {
      expect(within(table).getByRole('button', { name: /Role of Jalal Mia/ })).toHaveTextContent('Leader');
    });
  });
});

describe('team life cycle', () => {
  it('will not deactivate a team that has members today', async () => {
    await openAs('manager', '/workforce/teams/t1');
    await screen.findByRole('heading', { level: 1, name: 'Plucking Gang North' });
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Deactivate Plucking Gang North?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText(/still has members today/)).toBeInTheDocument();
  });

  it('tells why a team that had members cannot be deleted', async () => {
    await openAs('manager', '/workforce/teams/t1');
    await screen.findByRole('heading', { level: 1, name: 'Plucking Gang North' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Plucking Gang North?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Deactivate it instead/)).toBeInTheDocument();
  });
});

describe('deleting a team', () => {
  it('deletes a team that never had members', async () => {
    const router = await openAs('manager', '/workforce/teams/t3');
    await screen.findByRole('heading', { level: 1, name: 'Empty Team' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Empty Team?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/teams');
    });
  });
});

describe('a worker teams tab', () => {
  it('lists the teams a worker is in', async () => {
    await openAs('manager', '/workforce/profiles/pr2?tab=teams');
    expect(await screen.findByRole('link', { name: 'Plucking Gang North' })).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
  });
});
