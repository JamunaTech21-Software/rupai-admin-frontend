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

/** P2.01 Person registry (RUP-418): the list, the form, family members, and the person's life cycle. */

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

/** Opens a Select by its button and picks an option. */
async function choose(button: RegExp | string, option: string) {
  await userEvent.click(await screen.findByRole('button', { name: button }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('persons list', () => {
  it('lists the registered people with their details', async () => {
    await openAs('manager', '/workforce/persons');
    const table = await screen.findByRole('table', { name: 'Persons' });
    const row = (await within(table).findByRole('link', { name: 'PRS-P1' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Rahim Uddin')).toBeInTheDocument();
    expect(within(row).getByText('+8801711000001')).toBeInTheDocument();
    expect(within(row).getByText('Male')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('searches by name and says so when nobody matches', async () => {
    await openAs('manager', '/workforce/persons');
    const table = await screen.findByRole('table', { name: 'Persons' });
    await within(table).findByText('Rahim Uddin');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'Salma');
    await waitFor(() => {
      expect(within(table).queryByText('Rahim Uddin')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Salma Begum')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nobody-here');
    expect(await screen.findByText('No one matches')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    await openAs('manager', '/workforce/persons');
    const table = await screen.findByRole('table', { name: 'Persons' });
    await within(table).findByText('Rahim Uddin');
    await choose(/Status$/, 'Inactive');
    await waitFor(() => {
      expect(within(table).queryByText('Rahim Uddin')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Jalal Mia')).toBeInTheDocument();
  });

  it('is behind person.view', async () => {
    await openAs('viewer', '/workforce/persons');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('person form', () => {
  it('asks for a first name and shows the server refusal of a duplicate national id', async () => {
    await openAs('manager', '/workforce/persons/new');
    await screen.findByRole('heading', { level: 1, name: 'Add person' });
    await userEvent.click(screen.getByRole('button', { name: 'Save person' }));
    expect(await screen.findByText('Enter the first name.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /First name/ }), 'Karim');
    await userEvent.type(screen.getByRole('textbox', { name: /National ID/ }), '1985123456789');
    await userEvent.click(screen.getByRole('button', { name: 'Save person' }));
    expect(await screen.findByText('Another person has this national ID.')).toBeInTheDocument();
  });

  it('registers a person and opens their page', async () => {
    const router = await openAs('manager', '/workforce/persons/new');
    await userEvent.type(await screen.findByRole('textbox', { name: /First name/ }), 'Karim');
    await userEvent.type(screen.getByRole('textbox', { name: /^Last name/ }), 'Ali');
    await userEvent.click(screen.getByRole('button', { name: 'Save person' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/workforce\/persons\/p\d+$/);
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Karim Ali' })).toBeInTheDocument();
  });

  it('opens a person with their details, saves a change and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/persons/p1');
    await screen.findByRole('heading', { level: 1, name: 'Rahim Uddin' });
    expect(screen.getByRole('textbox', { name: /^Father name/ })).toHaveValue('Karim Uddin');
    expect(screen.getByRole('textbox', { name: /National ID/ })).toHaveValue('1985123456789');
    const phone = screen.getByRole('textbox', { name: /^Mobile no/ });
    await userEvent.clear(phone);
    await userEvent.type(phone, '+8801711999999');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/persons');
    });
    const table = await screen.findByRole('table', { name: 'Persons' });
    expect(await within(table).findByText('+8801711999999')).toBeInTheDocument();
  });

  it('needs the account number when paying by bank', async () => {
    await openAs('manager', '/workforce/persons/p2');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    await choose(/Payment method/, 'Bank');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter the bank account number.')).toBeInTheDocument();
  });

  it('copies the present address to the permanent one', async () => {
    await openAs('manager', '/workforce/persons/p2');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Present address' }), 'Line 4, Labour Quarter');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Same as present address' }));
    expect(screen.getByRole('textbox', { name: 'Permanent address' })).toHaveValue('Line 4, Labour Quarter');
  });
});

describe('family members and life cycle', () => {
  it('lists, adds and removes a family member', async () => {
    await openAs('manager', '/workforce/persons/p1');
    await screen.findByRole('heading', { level: 1, name: 'Rahim Uddin' });
    await userEvent.click(screen.getByRole('tab', { name: /Family members/ }));
    const table = await screen.findByRole('table', { name: 'Family members' });
    expect(await within(table).findByText('Rahim child 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add family member' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'New child');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(table).findByText('New child')).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Remove New child' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove New child?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(within(table).queryByText('New child')).not.toBeInTheDocument();
    });
  });

  it('deactivates and reactivates a person', async () => {
    await openAs('manager', '/workforce/persons/p1');
    await screen.findByRole('heading', { level: 1, name: 'Rahim Uddin' });
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Deactivate Rahim Uddin?' })).getByRole(
        'button',
        {
          name: 'Deactivate',
        },
      ),
    );
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('tells why a person in use cannot be deleted', async () => {
    await openAs('manager', '/workforce/persons/p_ref');
    await screen.findByRole('heading', { level: 1, name: 'Nasima Khatun' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Nasima Khatun?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByText(/Deactivate them instead/)).toBeInTheDocument();
  });

  it('shows what arrives with later stories', async () => {
    await openAs('manager', '/workforce/persons/p1');
    await screen.findByRole('heading', { level: 1, name: 'Rahim Uddin' });
    await userEvent.click(screen.getByRole('tab', { name: 'Employment' }));
    expect(await screen.findByText(/Available with P2\.02/)).toBeInTheDocument();
  });
});
