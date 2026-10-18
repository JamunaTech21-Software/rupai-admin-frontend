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
import { openSidebarGroup } from './sidebar';

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
    const estate = await openSidebarGroup('Estate Management');
    for (const name of ['Estates', 'Fields']) {
      expect(within(estate).getByRole('link', { name })).toBeInTheDocument();
    }
    const configuration = await openSidebarGroup('Configuration');
    expect(within(configuration).getByRole('link', { name: 'Organisation' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('shows "Not recorded" for a missing total area, and the area its fields add up to', async () => {
    await openAs('manager', '/estates');
    const table = await screen.findByRole('table', { name: 'Estates' });
    const row = (await within(table).findByRole('link', { name: 'Rupai Hills Tea Estate' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('Not recorded')).toBeInTheDocument();
    // f1 12.500 + f2 8.000 + f3 10.250, added as decimals.
    expect(await within(row).findByText('30.750 acres')).toBeInTheDocument();
  });

  it('the estate profile shows the summary the server works out, in acres', async () => {
    await openAs('manager', '/estates/e1');
    const overview = await screen.findByRole('region', { name: 'Estate Summary' });
    expect(await within(overview).findByText('28.750 acres')).toBeInTheDocument();
    // No total land area is declared, so the non-tea area is not known either.
    expect(within(overview).getAllByText('Not declared')).toHaveLength(2);
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
    await screen.findByRole('heading', { level: 1, name: 'Surma Tea Estate' }, { timeout: 15_000 });
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
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Estate profile saved')).toBeInTheDocument();
  });
});

describe('divisions and sections', () => {
  /** The table row whose cells include `text`. */
  /** Waits for the list to settle: rows are drawn again once every division's sections have loaded. */
  async function rowOf(table: HTMLElement, text: string) {
    return waitFor(() => {
      const row = within(table).getByText(text).closest('tr');
      if (!row) throw new Error(`no row for ${text}`);
      return row;
    });
  }

  it('lists the divisions and every section, and adds a section to the chosen division', async () => {
    await openAs('manager', '/estates/e1/divisions');
    const tabs = await screen.findByRole('navigation', { name: 'Estate management' });
    expect(within(tabs).getByRole('link', { name: '2. Division & Section' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const divisions = await screen.findByRole('table', { name: 'Divisions' });
    await rowOf(divisions, 'North');
    const sections = await screen.findByRole('table', { name: 'Sections' });
    await within(sections).findByText('North 1');
    await within(sections).findByText('North 2');

    // A section is added to the division chosen in the filter.
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Division$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'N · North' }));
    expect(await screen.findByRole('heading', { name: 'Section List (North)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add section' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add section to North' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'N3');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'North 3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await within(sections).findByText('North 3');

    const summary = screen.getByRole('region', { name: 'Division & Section Summary' });
    expect(within(summary).getByText('Total sections')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters the sections by name', async () => {
    await openAs('manager', '/estates/e1/divisions');
    const sections = await screen.findByRole('table', { name: 'Sections' });
    await within(sections).findByText('North 1');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search section' }), 'South');
    expect(within(sections).queryByText('North 1')).not.toBeInTheDocument();
    expect(within(sections).getByText('South 1')).toBeInTheDocument();
  });

  it('deleting a division with sections is refused: deactivate instead', async () => {
    await openAs('manager', '/estates/e1/divisions');
    const divisions = await screen.findByRole('table', { name: 'Divisions' });
    await userEvent.click(within(await rowOf(divisions, 'North')).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete North?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Deactivate it instead/)).toBeInTheDocument();
  });

  it('deletes an empty division', async () => {
    await openAs('manager', '/estates/e2/divisions');
    const divisions = await screen.findByRole('table', { name: 'Divisions' });
    await userEvent.click(
      within(await rowOf(divisions, 'Empty division')).getByRole('button', { name: 'Delete' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Empty division?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => {
      expect(within(divisions).queryByText('Empty division')).not.toBeInTheDocument();
    });
  });
});

describe('fields of an estate', () => {
  it("lists the estate's fields and shows the chosen one's details", async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    // Settled once the section names are in: the rows are drawn again when they load.
    await within(table).findAllByText('North 1 · North', { exact: false });
    const first = (await within(table).findAllByRole('button', { name: /^Details of / }))[0];
    if (!first) throw new Error('no fields');
    const name = (first.getAttribute('aria-label') ?? '').replace('Details of ', '');
    await userEvent.click(first);
    const details = await screen.findByRole('region', { name: `Field / Block Details (${name})` });
    expect(within(details).getByRole('link', { name: 'Open field' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/fields\//),
    );
    expect(screen.getByRole('region', { name: 'Field / Block Summary' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });
});

describe('fields', () => {
  it('shows where each field sits: its section and division by name', async () => {
    await openAs('manager', '/fields');
    const table = await screen.findByRole('table', { name: 'Fields' });
    const row = (await within(table).findByRole('link', { name: 'A-N1-1' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(await within(row).findByText('N1 · North 1')).toBeInTheDocument();
    expect(within(row).getByText('N · North')).toBeInTheDocument();
    expect(within(row).getByText('11.750 acres')).toBeInTheDocument();
  });

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
    const summary = screen.getByRole('region', { name: 'Organisation summary' });
    expect(within(summary).getByText('RUPAI')).toBeInTheDocument();
    expect(within(summary).getByText('Not recorded')).toBeInTheDocument();
    expect(within(summary).getByText('July')).toBeInTheDocument();
    expect(within(summary).getByText('Active')).toBeInTheDocument();
    const shortName = screen.getByRole('textbox', { name: /^Short name/ });
    await userEvent.clear(shortName);
    await userEvent.type(shortName, 'RTC');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Organisation saved')).toBeInTheDocument();
    // The summary follows the save.
    expect(
      await within(screen.getByRole('region', { name: 'Organisation summary' })).findByText('RTC'),
    ).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('needs organisation.view', async () => {
    await openAs('viewer', '/organisation');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
