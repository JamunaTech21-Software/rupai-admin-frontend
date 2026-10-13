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

/** P1.09 (RUP-181): seasons, fiscal years and accounting periods. */

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

async function confirm(title: string, button: string) {
  const dialog = await screen.findByRole('alertdialog', { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
}

describe('seasons', () => {
  it('lists seasons with their estate and state, and is in the sidebar', async () => {
    await openAs('manager', '/seasons');
    const table = await screen.findByRole('table', { name: 'Seasons' });
    const rows = await within(table).findAllByRole('link', { name: /^Season / });
    expect(rows).toHaveLength(4);
    expect(within(table).getByText('Planned')).toBeInTheDocument();
    expect(within(table).getAllByText('Closed')).toHaveLength(2);
    expect(await within(table).findAllByText('Jamuna Valley Tea Estate')).toHaveLength(2);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Seasons', 'Fiscal years', 'Accounting periods']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('activates a planned season, then closes it', async () => {
    await openAs('manager', '/seasons/se3');
    await screen.findByRole('heading', { level: 1, name: 'Season 2026-27' });
    const summary = screen.getByRole('region', { name: 'Season summary' });
    expect(await within(summary).findByText('DEMO-B')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await confirm('Activate Season 2026-27?', 'Activate');
    expect(await screen.findByText('Season 2026-27 is active')).toBeInTheDocument();
    // Active: only the name and end date can still be changed, and it can no longer be deleted.
    expect(
      await screen.findByText('This season is active: only its name and end date can be changed.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Code/ })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: /^Name/ })).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close season' }));
    await confirm('Close Season 2026-27?', 'Close season');
    expect(await screen.findByText('Season 2026-27 is closed')).toBeInTheDocument();
    expect(
      await screen.findByText('This season is closed and can no longer be changed.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('shows the overlapping season next to the dates', async () => {
    await openAs('manager', '/seasons/se3');
    await screen.findByRole('heading', { level: 1, name: 'Season 2026-27' });
    // One year earlier, the planned season runs into DEMO-B's closed 2025-26 season.
    const start = screen.getByRole('group', { name: /^Start date/ });
    const year = within(start).getByRole('spinbutton', { name: /year/i });
    await userEvent.click(year);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('overlaps season 2025-26 (2025-03-01 to 2026-02-28)')).toBeInTheDocument();
  });

  it('deletes a planned season', async () => {
    const router = await openAs('manager', '/seasons/se3');
    await screen.findByRole('heading', { level: 1, name: 'Season 2026-27' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await confirm('Delete Season 2026-27?', 'Delete');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/seasons');
    });
    // The list is a lazy route: give it room when the suite runs in parallel.
    const table = await screen.findByRole('table', { name: 'Seasons' }, { timeout: 10_000 });
    await waitFor(() => {
      expect(within(table).getAllByRole('link', { name: /^Season / })).toHaveLength(3);
    });
  });

  it('needs season.view', async () => {
    await openAs('viewer', '/seasons');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('fiscal years and periods', () => {
  it('lists fiscal years with their periods and state', async () => {
    await openAs('manager', '/fiscal-years');
    const table = await screen.findByRole('table', { name: 'Fiscal years' });
    const row = (await within(table).findByRole('link', { name: 'Fiscal year 2026-27' })).closest('tr');
    if (!row) throw new Error('row missing');
    expect(within(row).getByText('FY2026-27')).toBeInTheDocument();
    expect(within(row).getByText('13')).toBeInTheDocument();
    expect(within(row).getByText('Open')).toBeInTheDocument();
  });

  it('shows a fiscal year with its 13 periods', async () => {
    await openAs('manager', '/fiscal-years/fy1');
    await screen.findByRole('heading', { level: 1, name: 'Fiscal year 2026-27' });
    const summary = screen.getByRole('region', { name: 'Fiscal year summary' });
    expect(within(summary).getByText('13')).toBeInTheDocument();
    expect(await within(summary).findByText('4')).toBeInTheDocument();

    const periods = await screen.findByRole('table', { name: 'Accounting periods' });
    expect(await within(periods).findByText('July 2026')).toBeInTheDocument();
    expect(within(periods).getAllByText('Year-end adjustments').length).toBeGreaterThan(0);
    // An opened year cannot be deleted, and only the first future period can be opened.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(periods).getAllByRole('button', { name: /^Open / })).toHaveLength(1);
    expect(within(periods).getByRole('button', { name: 'Open November 2026' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('opens the next period', async () => {
    await openAs('manager', '/fiscal-years/fy1');
    const periods = await screen.findByRole('table', { name: 'Accounting periods' });
    await userEvent.click(await within(periods).findByRole('button', { name: 'Open November 2026' }));
    await confirm('Open November 2026?', 'Open');
    expect(await screen.findByText('November 2026 is open')).toBeInTheDocument();
    expect(await within(periods).findByRole('button', { name: 'Open December 2026' })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Fiscal year summary' });
    expect(await within(summary).findByText('5')).toBeInTheDocument();
  });

  it('adds a fiscal year from its start year, then generates its periods', async () => {
    const router = await openAs('manager', '/fiscal-years');
    await screen.findByRole('table', { name: 'Fiscal years' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add fiscal year' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add fiscal year' });
    // The year after the latest one is suggested.
    expect(within(dialog).getByRole('textbox', { name: /^Start year/ })).toHaveValue('2027');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create fiscal year' }));

    // The new year's page is a lazy route: give it room when the suite runs in parallel.
    await screen.findByRole('heading', { level: 1, name: 'Fiscal year 2027-28' }, { timeout: 10_000 });
    expect(router.state.location.pathname).toMatch(/^\/fiscal-years\/fy_new_/);
    const summary = screen.getByRole('region', { name: 'Fiscal year summary' });
    expect(within(summary).getByText('Not generated')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Generate periods' }));
    expect(await screen.findByText('13 periods generated')).toBeInTheDocument();
    const periods = await screen.findByRole('table', { name: 'Accounting periods' });
    expect(await within(periods).findByText('July 2027')).toBeInTheDocument();
    expect(within(periods).getByRole('button', { name: 'Open July 2027' })).toBeInTheDocument();
  });

  it('refuses an overlapping fiscal year on the start year', async () => {
    await openAs('manager', '/fiscal-years');
    await screen.findByRole('table', { name: 'Fiscal years' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add fiscal year' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add fiscal year' });
    const year = within(dialog).getByRole('textbox', { name: /^Start year/ });
    await userEvent.clear(year);
    await userEvent.type(year, '2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create fiscal year' }));
    expect(
      await within(dialog).findByText('overlaps fiscal year FY2026-27 (2026-07-01 to 2027-06-30)'),
    ).toBeInTheDocument();
  });

  it('lists accounting periods and offers Open on the next one only', async () => {
    await openAs('manager', '/accounting-periods');
    const table = await screen.findByRole('table', { name: 'Accounting periods' });
    expect(await within(table).findByText('July 2026')).toBeInTheDocument();
    expect(await within(table).findAllByRole('link', { name: 'FY2026-27' })).toHaveLength(13);
    await waitFor(() => {
      expect(within(table).getAllByRole('button', { name: /^Open / })).toHaveLength(1);
    });
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('fixes the financial year start month once a fiscal year exists', async () => {
    await openAs('manager', '/organisation');
    await screen.findByRole('heading', { level: 1, name: 'Organisation' });
    expect(await screen.findByText('Fixed once a fiscal year exists.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Financial year starts in/ })).toBeDisabled();
  });
});
