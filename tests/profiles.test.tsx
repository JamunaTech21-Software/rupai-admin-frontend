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

/** P2.02 Employment profiles (RUP-434): the worker and employee lists, the profile form, and separation. */

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

/** The figure under a card's label. */
const figure = (label: string) => screen.getByText(label).closest('div')?.textContent ?? '';

describe('workers and employees', () => {
  it('lists workers with their cards, section and status', async () => {
    await openAs('manager', '/workforce/workers');
    const table = await screen.findByRole('table', { name: 'Worker management' });
    const row = (await within(table).findByRole('link', { name: 'WRK-A-0001' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByRole('cell', { name: 'Salma Begum' })).toBeInTheDocument();
    expect(within(row).getByText('North 1')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(table).queryByText('EMP-A-0001')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(figure('Total workers')).toContain('2');
    });
    expect(figure('On leave today')).toContain('1');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('lists employees with their designation', async () => {
    await openAs('manager', '/workforce/employees');
    const table = await screen.findByRole('table', { name: 'Employee management' });
    const row = (await within(table).findByRole('link', { name: 'EMP-A-0001' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Field Supervisor')).toBeInTheDocument();
    expect(within(table).queryByText('WRK-A-0001')).not.toBeInTheDocument();
  });

  it('filters by status and searches by name', async () => {
    await openAs('manager', '/workforce/workers');
    const table = await screen.findByRole('table', { name: 'Worker management' });
    await within(table).findByRole('link', { name: 'WRK-A-0001' });
    await choose(/Status$/, 'On leave');
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'WRK-A-0001' })).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'WRK-A-0002' })).toBeInTheDocument();
    await choose(/Status$/, 'All statuses');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nobody-here');
    expect(await screen.findByText('No one matches')).toBeInTheDocument();
  });

  it('shows the charts and this month birthdays and anniversaries', async () => {
    await openAs('manager', '/workforce/workers');
    expect(await screen.findByRole('heading', { name: 'By category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By age group' })).toBeInTheDocument();
    const birthdays = screen.getByRole('heading', { name: 'Birthdays this month' }).closest('section');
    if (!birthdays) throw new Error('no birthdays');
    expect(within(birthdays).getByRole('link', { name: 'Rahim Uddin' })).toBeInTheDocument();
  });

  it('is behind employment.view', async () => {
    await openAs('viewer', '/workforce/workers');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('profile form', () => {
  it('picks the person on the first click and keeps the choice', async () => {
    await openAs('manager', '/workforce/profiles/new?type=worker');
    await screen.findByRole('heading', { level: 1, name: 'Add new worker' });
    const person = await screen.findByRole('combobox', { name: /Person/ });
    await userEvent.click(person);
    await userEvent.type(person, 'Sal');
    await userEvent.click(await screen.findByRole('option', { name: /Salma Begum/ }, { timeout: 4000 }));
    // The list reloads for the chosen name; the choice must survive it.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(screen.getByRole('combobox', { name: /Person/ })).toHaveValue('Salma Begum');
    // And it is what is saved: the form asks for the rest, not for the person.
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Choose the garden / unit.')).toBeInTheDocument();
    expect(screen.queryByText('Choose the person.')).not.toBeInTheDocument();
  });

  it('opens a profile for the person it was opened from and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/profiles/new?type=worker&person=p_ref');
    await screen.findByRole('heading', { level: 1, name: 'Add new worker' });
    expect(await screen.findByText('Nasima Khatun')).toBeInTheDocument();
    await choose(/Garden/, 'DEMO-A · Rupai Hills Tea Estate');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Enter the joining date.')).toBeInTheDocument();
    const joined = screen.getByRole('group', { name: /^Join date/ });
    await userEvent.click(within(joined).getByRole('spinbutton', { name: /month/i }));
    await userEvent.keyboard('01052025');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/workers');
    });
    const table = await screen.findByRole('table', { name: 'Worker management' });
    expect(await within(table).findByRole('cell', { name: 'Nasima Khatun' })).toBeInTheDocument();
  });

  it('saves a change and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/profiles/pr2');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    expect(screen.getByRole('textbox', { name: /^Worker ID/ })).toHaveValue('WRK-A-0001');
    await choose(/Job nature/, 'Factory');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/workers');
    });
  });

  it('suspends and reinstates with a reason', async () => {
    await openAs('manager', '/workforce/profiles/pr2');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend Salma Begum?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await within(dialog).findByText('Give a reason of at least 3 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Under inquiry');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByRole('button', { name: 'Reinstate' })).toBeInTheDocument();
  });

  it('separates a profile, which then can only be looked at', async () => {
    await openAs('manager', '/workforce/profiles/pr3');
    await screen.findByRole('heading', { level: 1, name: 'Jalal Mia' });
    await userEvent.click(screen.getByRole('button', { name: 'Separate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Separate Jalal Mia' });
    await choose(/Reason type/, 'Resignation');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason$/ }), 'Moved away');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Separate' }));
    expect(await screen.findByText('This employment has ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Separate' })).not.toBeInTheDocument();
  });
});

describe('a person employment tab', () => {
  it('shows the service totals and history, with a way to open a profile', async () => {
    await openAs('manager', '/workforce/persons/p2');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    await userEvent.click(screen.getByRole('tab', { name: 'Employment' }));
    expect(await screen.findByRole('link', { name: 'WRK-A-0001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add employment profile' })).toHaveAttribute(
      'href',
      '/workforce/profiles/new?person=p2',
    );
  });
});
