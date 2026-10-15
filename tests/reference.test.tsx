import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { organisationMocks, resetOrganisationMocks } from '@/features/organisation/api/mocks';
import { referenceMocks, resetReferenceMocks } from '@/features/reference/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';
import { openSidebarGroup } from './sidebar';

/** P1.10 (RUP-197): the reference masters, units of measure and tea grades. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetOrganisationMocks();
  resetReferenceMocks();
  setAccessToken(null);
  server.use(...authMocks(BASE), ...organisationMocks(BASE), ...referenceMocks(BASE));
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

async function confirm(title: string, button: string) {
  const dialog = await screen.findByRole('alertdialog', { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
}

/** The table row whose name cell reads `name`. */
async function rowOf(table: HTMLElement, name: string) {
  const row = (await within(table).findByText(name)).closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe('reference data', () => {
  it('lists the masters by group, with counts, and is in the sidebar', async () => {
    await openAs('manager', '/masters');
    await screen.findByRole('heading', { level: 1, name: 'Reference data' });
    for (const group of ['People and work', 'Tea', 'Stock and units', 'General']) {
      expect(screen.getByRole('heading', { level: 2, name: group })).toBeInTheDocument();
    }
    const main = screen.getByRole('main');
    const departments = within(main).getByRole('link', { name: 'Departments' });
    expect(departments).toHaveAttribute('href', '/masters/department');
    // Counts come from the lists loaded at sign-in: two of the three departments are active.
    const item = departments.closest('li');
    if (!item) throw new Error('item missing');
    expect(await within(item).findByText('2 active')).toBeInTheDocument();
    // Units and tea grades have pages of their own.
    expect(within(main).getByRole('link', { name: 'Units of measure' })).toHaveAttribute('href', '/uoms');
    expect(within(main).getByRole('link', { name: 'Tea grades' })).toHaveAttribute('href', '/tea-grades');

    const nav = await openSidebarGroup('Master Data');
    for (const name of ['All masters', 'Units of measure', 'Tea grades']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('shows one master with active and inactive rows', async () => {
    await openAs('manager', '/masters/department');
    await screen.findByRole('heading', { level: 1, name: 'Departments' });
    const table = await screen.findByRole('table', { name: 'Departments' });
    expect(within(await rowOf(table, 'Field')).queryByText('Inactive')).not.toBeInTheDocument();
    expect(within(await rowOf(table, 'Stores')).getByText('Inactive')).toBeInTheDocument();
    expect(within(table).getByText('FACTORY')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('adds a row, and shows a duplicate code on the code field', async () => {
    await openAs('manager', '/masters/department');
    const table = await screen.findByRole('table', { name: 'Departments' });
    await rowOf(table, 'Field');
    await userEvent.click(screen.getByRole('button', { name: 'Add department' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add department' });

    // Nothing entered: the required fields say so.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('Enter the code.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the name.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'FIELD');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Workshop');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('is already in use')).toBeInTheDocument();

    const code = within(dialog).getByRole('textbox', { name: /^Code/ });
    await userEvent.clear(code);
    await userEvent.type(code, 'WORKSHOP');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Workshop added')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Workshop')).getByText('WORKSHOP')).toBeInTheDocument();
  });

  it('renames a row', async () => {
    await openAs('manager', '/masters/department');
    const table = await screen.findByRole('table', { name: 'Departments' });
    await userEvent.click(await within(table).findByRole('button', { name: 'Edit Factory' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Factory' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Tea factory');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Tea factory saved')).toBeInTheDocument();
    expect(await within(table).findByRole('button', { name: 'Edit Tea factory' })).toBeInTheDocument();
  });

  it('deactivates and reactivates a row', async () => {
    await openAs('manager', '/masters/department');
    const table = await screen.findByRole('table', { name: 'Departments' });
    await userEvent.click(
      within(await rowOf(table, 'Field')).getByRole('button', { name: 'Deactivate Field' }),
    );
    await confirm('Deactivate Field?', 'Deactivate');
    expect(await screen.findByText('Field deactivated')).toBeInTheDocument();
    await waitFor(async () => {
      expect(within(await rowOf(table, 'Field')).getByText('Inactive')).toBeInTheDocument();
    });

    await userEvent.click(
      within(await rowOf(table, 'Field')).getByRole('button', { name: 'Reactivate Field' }),
    );
    await confirm('Reactivate Field?', 'Reactivate');
    expect(await screen.findByText('Field reactivated')).toBeInTheDocument();
  });

  it('keeps a system record: its code is locked and it cannot be retired', async () => {
    await openAs('manager', '/masters/worker-category');
    const table = await screen.findByRole('table', { name: 'Worker categories' });
    const row = await rowOf(table, 'Permanent worker');
    expect(within(row).getByText('System')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Deactivate / })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Edit Permanent worker' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Permanent worker' });
    expect(within(dialog).getByText(/This is a system record/)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /^Code/ })).toHaveAttribute('readonly');
    expect(within(dialog).getByRole('textbox', { name: /^Name/ })).not.toHaveAttribute('readonly');
  });

  it('deletes a row nothing uses, and explains the refusal for one in use', async () => {
    await openAs('manager', '/masters/tea-type');
    const table = await screen.findByRole('table', { name: 'Tea types' });
    // Green tea has no grades: it goes.
    await userEvent.click(await within(table).findByRole('button', { name: 'Delete Green tea' }));
    await confirm('Delete Green tea?', 'Delete');
    expect(await screen.findByText('Green tea deleted')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(table).queryByText('Green tea')).not.toBeInTheDocument();
    });

    // CTC has a grade: the server refuses and says what to do instead.
    await userEvent.click(within(table).getByRole('button', { name: 'Delete CTC' }));
    await confirm('Delete CTC?', 'Delete');
    expect(await screen.findByText('This tea type is in use, so it cannot be deleted.')).toBeInTheDocument();
    expect(within(table).getAllByText('CTC').length).toBeGreaterThan(0);
  });

  it('shows the first-use empty state for a master with no rows', async () => {
    await openAs('manager', '/masters/leave-type');
    expect(await screen.findByText('No leave types yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add leave type' }).length).toBeGreaterThan(0);
  });

  it('shows each master its own fields: shifts with estate, times and overnight', async () => {
    await openAs('manager', '/masters/shift');
    const table = await screen.findByRole('table', { name: 'Shifts' });
    const day = await rowOf(table, 'Day shift');
    expect(within(day).getByText('All estates')).toBeInTheDocument();
    expect(within(day).getByText('06:00')).toBeInTheDocument();
    const night = await rowOf(table, 'Night shift');
    expect(await within(night).findByText('DEMO-A')).toBeInTheDocument();
    expect(within(night).getByText('Yes')).toBeInTheDocument();
  });

  it('answers an unknown master with not found', async () => {
    await openAs('manager', '/masters/no-such-master');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('needs lookup.view', async () => {
    await openAs('viewer', '/masters/department');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('units of measure', () => {
  it('lists the units with their category, and the categories with their base unit', async () => {
    await openAs('manager', '/uoms');
    await screen.findByRole('heading', { level: 1, name: 'Units of measure' });
    const table = await screen.findByRole('table', { name: 'Units of measure' });
    const kg = await rowOf(table, 'Kilogram');
    expect(await within(kg).findByText('Weight')).toBeInTheDocument();
    expect(within(kg).getByText('Base')).toBeInTheDocument();
    // The base unit is never retired.
    expect(within(kg).queryByRole('button', { name: /^Deactivate / })).not.toBeInTheDocument();
    expect(within(await rowOf(table, 'Tonne')).getByText('1,000')).toBeInTheDocument();

    const categories = screen.getByRole('heading', { level: 2, name: 'Unit categories' }).closest('section');
    if (!categories) throw new Error('categories card missing');
    expect(await within(categories).findByText(/Base unit: kg · Kilogram/)).toBeInTheDocument();
    expect(within(categories).getAllByText(/No base unit/)).toHaveLength(2);
    // A category without units has no base unit to choose.
    expect(within(categories).queryByRole('button', { name: /base unit of Count/ })).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('sets the base unit of a category', async () => {
    await openAs('manager', '/uoms');
    await userEvent.click(await screen.findByRole('button', { name: 'Set base unit of Volume' }));
    const dialog = await screen.findByRole('dialog', { name: 'Base unit of Volume' });
    // Nothing chosen yet.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Choose the base unit.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /Base unit/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'l · Litre' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('The base unit of Volume is Litre')).toBeInTheDocument();
    expect(await screen.findByText(/Base unit: l · Litre/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Change base unit of Volume' })).toBeInTheDocument();
  });

  it('explains why a base unit cannot be changed while other units convert against it', async () => {
    await openAs('manager', '/uoms');
    await userEvent.click(await screen.findByRole('button', { name: 'Change base unit of Weight' }));
    const dialog = await screen.findByRole('dialog', { name: 'Base unit of Weight' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Base unit/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'ton · Tonne' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(
      (
        await screen.findAllByText(
          'Units of this category have conversion factors against the current base unit; clear them first.',
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('tea grades', () => {
  it('lists the grades with their tea type', async () => {
    await openAs('manager', '/tea-grades');
    const table = await screen.findByRole('table', { name: 'Tea grades' });
    expect(within(await rowOf(table, 'Broken Orange Pekoe')).getByText('All tea types')).toBeInTheDocument();
    const dust = await rowOf(table, 'Pekoe Dust');
    expect(await within(dust).findByText('CTC')).toBeInTheDocument();
    expect(within(dust).getByText('Dust')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters by tea type to the grades that may be chosen for it', async () => {
    await openAs('manager', '/tea-grades?filter%5Bvalid_for_tea_type_id%5D=tt1');
    const table = await screen.findByRole('table', { name: 'Tea grades' });
    // CTC's own grade and the universal one, not Orthodox's.
    await rowOf(table, 'Pekoe Dust');
    expect(within(table).getByText('Broken Orange Pekoe')).toBeInTheDocument();
    expect(within(table).queryByText('Orange Pekoe')).not.toBeInTheDocument();
  });
});

describe('organisation settings', () => {
  it('shows the country picker and the base currency', async () => {
    await openAs('manager', '/organisation');
    await screen.findByRole('heading', { level: 1, name: 'Organisation' });
    const country = screen.getByRole('button', { name: /Country/ });
    await waitFor(() => {
      expect(country).toHaveTextContent('Bangladesh');
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Base currency/ })).toHaveValue('BDT · Bangladeshi taka');
    });
  });
});
