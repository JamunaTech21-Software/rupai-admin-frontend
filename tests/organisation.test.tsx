import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import {
  organisationMocks,
  resetOrganisationMocks,
  setMockEstateScope,
} from '@/features/organisation/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.07 (RUP-149): organisation settings, estates with divisions and sections, and fields. */

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

async function choose(label: RegExp, option: string) {
  await userEvent.click(screen.getByRole('button', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('estates', () => {
  it('lists estates, and the sidebar has the Organisation section', async () => {
    await openAs('manager', '/estates');
    const table = await screen.findByRole('table', { name: 'Estates' });
    expect(await within(table).findByRole('link', { name: 'Rupai Hills Tea Estate' })).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Jamuna Valley Tea Estate' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Estates', 'Fields', 'Organisation']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('a scoped user sees which estates the list is limited to', async () => {
    setMockEstateScope(['e1']);
    await openAs('manager', '/estates');
    const table = await screen.findByRole('table', { name: 'Estates' });
    await within(table).findByRole('link', { name: 'Rupai Hills Tea Estate' });
    expect(within(table).queryByRole('link', { name: 'Jamuna Valley Tea Estate' })).not.toBeInTheDocument();
    expect(await screen.findByText('Showing: Rupai Hills Tea Estate')).toBeInTheDocument();
  });

  it('creates an estate and opens it', async () => {
    const router = await openAs('manager', '/estates/new');
    await screen.findByRole('heading', { level: 1, name: 'Add estate' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'DEMO-C');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Surma Tea Estate');
    await userEvent.click(screen.getByRole('button', { name: 'Create estate' }));
    await screen.findByRole('heading', { level: 1, name: 'Surma Tea Estate' });
    expect(router.state.location.pathname).toMatch(/^\/estates\/e_new_/);
  });

  it('a duplicate code is shown on the field', async () => {
    await openAs('manager', '/estates/new');
    await screen.findByRole('heading', { level: 1, name: 'Add estate' });
    await userEvent.type(screen.getByRole('textbox', { name: /^Code/ }), 'DEMO-A');
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'Copy');
    await userEvent.click(screen.getByRole('button', { name: 'Create estate' }));
    expect(await screen.findByText('An estate with this code already exists.')).toBeInTheDocument();
  });

  it('edits an estate with If-Match', async () => {
    await openAs('manager', '/estates/e1');
    await screen.findByRole('heading', { level: 1, name: 'Rupai Hills Tea Estate' });
    const district = screen.getByRole('textbox', { name: /^District/ });
    await userEvent.clear(district);
    await userEvent.type(district, 'Sylhet');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Estate saved')).toBeInTheDocument();
  });
});

describe('divisions and sections', () => {
  it('expands a division to its sections and adds a section', async () => {
    await openAs('manager', '/estates/e1');
    const structure = await screen.findByRole('region', { name: 'Divisions and sections' });
    await userEvent.click(await within(structure).findByRole('button', { name: /N · North/ }));
    expect(await within(structure).findByText('North 1')).toBeInTheDocument();
    expect(within(structure).getByText('North 2')).toBeInTheDocument();

    await userEvent.click(within(structure).getByRole('button', { name: 'Add section' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add section to North' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'N3');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'North 3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(structure).findByText('North 3')).toBeInTheDocument();
  });

  it('deleting a division with sections is refused: deactivate instead', async () => {
    await openAs('manager', '/estates/e1');
    const structure = await screen.findByRole('region', { name: 'Divisions and sections' });
    await userEvent.click(await within(structure).findByRole('button', { name: /N · North/ }));
    await within(structure).findByText('North 1');
    // The division's own Delete is the first one in its panel (the sections' come after).
    const [divisionDelete] = within(structure).getAllByRole('button', { name: 'Delete' });
    if (!divisionDelete) throw new Error('no Delete button');
    await userEvent.click(divisionDelete);
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete North?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Deactivate it instead/)).toBeInTheDocument();
  });

  it('deletes an empty division', async () => {
    await openAs('manager', '/estates/e2');
    const structure = await screen.findByRole('region', { name: 'Divisions and sections' });
    await userEvent.click(await within(structure).findByRole('button', { name: /EMPTY · Empty division/ }));
    await within(structure).findByText('No sections in this division yet.');
    await userEvent.click(within(structure).getByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Empty division?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => {
      expect(
        within(structure).queryByRole('button', { name: /EMPTY · Empty division/ }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('fields', () => {
  it('filters fields by estate', async () => {
    await openAs('manager', '/fields');
    const table = await screen.findByRole('table', { name: 'Fields' });
    await within(table).findByRole('link', { name: 'A-N1-1' });
    await choose(/Any estate/, 'DEMO-B · Jamuna Valley Tea Estate');
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'A-N1-1' })).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'B-V1-1' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('creates a field in a section chosen estate → division → section; planted cannot exceed gross', async () => {
    const router = await openAs('manager', '/fields/new');
    await screen.findByRole('heading', { level: 1, name: 'Add field' });
    await choose(/^Choose… Estate/, 'DEMO-A · Rupai Hills Tea Estate');
    await choose(/^Choose… Division/, 'S · South');
    await choose(/^Choose… Section/, 'S1 · South 1');
    await userEvent.type(screen.getByRole('textbox', { name: /^Field number/ }), 'A-S1-1');
    await userEvent.type(screen.getByRole('textbox', { name: /^Gross area/ }), '5');
    await userEvent.type(screen.getByRole('textbox', { name: /^Planted area/ }), '6');
    await userEvent.click(screen.getByRole('button', { name: 'Create field' }));
    expect(
      await screen.findByText('The planted area cannot be larger than the gross area.'),
    ).toBeInTheDocument();

    const planted = screen.getByRole('textbox', { name: /^Planted area/ });
    await userEvent.clear(planted);
    await userEvent.type(planted, '4.5');
    await userEvent.click(screen.getByRole('button', { name: 'Create field' }));
    await screen.findByRole('heading', { level: 1, name: 'A-S1-1' });
    expect(router.state.location.pathname).toMatch(/^\/fields\/f_new_/);
  });

  it('moves a field to another section from a date', async () => {
    await openAs('manager', '/fields/f1');
    await screen.findByRole('heading', { level: 1, name: 'A-N1-1' });
    let location = screen.getByRole('region', { name: 'Location' });
    expect(await within(location).findByText('N1 · North 1')).toBeInTheDocument();
    await userEvent.click(within(location).getByRole('button', { name: 'Move to another section' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move field A-N1-1' });
    await userEvent.click(within(dialog).getByRole('button', { name: /New section/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'N2 · North 2' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to another section' }));
    expect(await screen.findByText('Field moved to North 2')).toBeInTheDocument();
    // The page reloads the field at its new version.
    location = await screen.findByRole('region', { name: 'Location' });
    expect(await within(location).findByText('N2 · North 2')).toBeInTheDocument();
  });
});

describe('organisation', () => {
  it('edits the organisation settings', async () => {
    await openAs('manager', '/organisation');
    await screen.findByRole('heading', { level: 1, name: 'Organisation' });
    const shortName = screen.getByRole('textbox', { name: /^Short name/ });
    await userEvent.clear(shortName);
    await userEvent.type(shortName, 'RTC');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Organisation saved')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('needs organisation.view', async () => {
    await openAs('viewer', '/organisation');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
