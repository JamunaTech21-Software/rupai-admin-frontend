import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { organisationMocks, resetOrganisationMocks } from '@/features/organisation/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.08 (RUP-165): factories, warehouses, parties and the reusable contacts panel. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetOrganisationMocks();
  setAccessToken(null);
  server.use(...authMocks(BASE), ...organisationMocks(BASE));
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

describe('factories', () => {
  it('lists factories, flags an expired licence, and is in the sidebar', async () => {
    await openAs('manager', '/factories');
    const table = await screen.findByRole('table', { name: 'Factories' });
    expect(await within(table).findByRole('link', { name: 'Rupai Central Factory' })).toBeInTheDocument();
    expect(within(table).getByText('Licence expired')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Factories', 'Warehouses', 'Parties']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('creates a factory with its main estate', async () => {
    const router = await openAs('manager', '/factories/new');
    await screen.findByRole('heading', { level: 1, name: 'Add factory' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'DEMO-F2');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Valley Factory');
    await userEvent.click(screen.getByRole('button', { name: /None.*Main estate|Main estate/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'DEMO-B · Jamuna Valley Tea Estate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create factory' }));
    await screen.findByRole('heading', { level: 1, name: 'Valley Factory' });
    expect(router.state.location.pathname).toMatch(/^\/factories\/fa_new_/);
  });

  it('needs factory.view', async () => {
    await openAs('viewer', '/factories');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('warehouse contacts', () => {
  it('lists the primary contact first; the phone comes from it and follows "Make primary"', async () => {
    await openAs('manager', '/warehouses/w1');
    await screen.findByRole('heading', { level: 1, name: 'Chattogram Auction Warehouse' });
    expect(screen.getByRole('textbox', { name: /^Phone/ })).toHaveValue('+8801711000001');
    expect(screen.getByRole('textbox', { name: /^Phone/ })).toHaveAttribute('readonly');

    const panel = screen.getByRole('region', { name: 'Contacts' });
    const rows = await within(panel).findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Karim Uddin');
    expect(rows[0]).toHaveTextContent('Primary');

    await userEvent.click(within(panel).getByRole('button', { name: 'Make primary' }));
    expect(await screen.findByText('Salma Begum is now the primary contact')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /^Phone/ })).toHaveValue('+8801711000002');
    });
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('edits and removes a contact', async () => {
    await openAs('manager', '/warehouses/w1');
    const panel = await screen.findByRole('region', { name: 'Contacts' });
    const salma = (await within(panel).findByText('Salma Begum')).closest('li') as HTMLElement;
    await userEvent.click(within(salma).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Salma Begum' });
    const designation = within(dialog).getByRole('textbox', { name: /^Designation/ });
    await userEvent.clear(designation);
    await userEvent.type(designation, 'Chief accountant');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Chief accountant')).toBeInTheDocument();

    const row = within(panel).getByText('Salma Begum').closest('li') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Remove Salma Begum?' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    await waitFor(() => {
      expect(within(panel).queryByText('Salma Begum')).not.toBeInTheDocument();
    });
  });
});

describe('parties', () => {
  it('the first contact of a party becomes its primary contact', async () => {
    await openAs('manager', '/parties/p1');
    await screen.findByRole('heading', { level: 1, name: 'Abdul Haque (lessee)' });
    const panel = screen.getByRole('region', { name: 'Contacts' });
    expect(await within(panel).findByText('No contacts yet')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Rafiq Haque');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Phone$|^Phone/ }), '+8801711000099');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    const row = (await within(panel).findByText('Rafiq Haque')).closest('li') as HTMLElement;
    expect(row).toHaveTextContent('Primary');
  });

  it('checks a phone number before sending', async () => {
    await openAs('manager', '/parties/new');
    await screen.findByRole('heading', { level: 1, name: 'Add party' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'DEMO-P2');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Land Office');
    await userEvent.type(screen.getByRole('textbox', { name: /^Phone/ }), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Create party' }));
    expect(await screen.findByText('Enter a phone number such as +8801711000000.')).toBeInTheDocument();
  });
});
