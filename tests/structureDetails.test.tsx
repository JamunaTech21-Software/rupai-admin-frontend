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

/**
 * R.3 follow-up (RUP-642): what the backend now holds for fields, divisions and sections: field type, parent field,
 * planting year, bush type, spacing, altitude, slope, irrigation, soil, drainage and who added it; descriptions and
 * parent sections; Total Section; the estate's sections in one request; and the figures under the lists.
 */

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

/** The value shown under a figure's label in a summary card. */
const figure = async (region: HTMLElement, label: string) => {
  const name = await within(region).findByText(label);
  return name.parentElement?.textContent ?? '';
};

const rowOf = async (table: HTMLElement, text: string) => {
  const [first] = await within(table).findAllByText(text);
  const row = first?.closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

describe('division and section', () => {
  it('shows each division’s Total Section and the section’s parent, and the figures the server works out', async () => {
    await openAs('manager', '/estates/e1/divisions');
    const divisions = await screen.findByRole('table', { name: 'Divisions' });
    // North has two sections, South one: counted by the server, not by the page.
    expect(
      within(await rowOf(divisions, 'North'))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toContain('2');
    expect(
      within(await rowOf(divisions, 'South'))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toContain('1');
    const sections = await screen.findByRole('table', { name: 'Sections' });
    await within(sections).findByText('North 1');
    expect(within(sections).getAllByRole('columnheader', { name: 'Parent section' })).toHaveLength(1);

    const summary = screen.getByRole('region', { name: 'Division & Section Summary' });
    await waitFor(async () => {
      expect(await figure(summary, 'Total divisions')).toContain('2');
    });
    expect(await figure(summary, 'Total sections')).toContain('3');
    expect(await figure(summary, 'Active divisions')).toContain('2');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('adds a section inside another section, with a description', async () => {
    await openAs('manager', '/estates/e1/divisions');
    const sections = await screen.findByRole('table', { name: 'Sections' });
    await within(sections).findByText('North 1');
    await userEvent.click(screen.getByRole('button', { name: /Division$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'N · North' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add section' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add section to North' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'N1A');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'North 1 East');
    await userEvent.click(within(dialog).getByRole('button', { name: /Parent section/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'N1 · North 1' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'The eastern half.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    const row = await rowOf(sections, 'North 1 East');
    expect(within(row).getByText('North 1')).toBeInTheDocument();
  });
});

describe('field / block', () => {
  it('shows the field type in the list and every detail of the chosen field', async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    expect(await within(table).findByText('Nursery')).toBeInTheDocument();
    await userEvent.click(
      await within(table).findByRole('button', { name: 'Details of A-N1-1 · Block One' }),
    );
    const details = await screen.findByRole('region', { name: 'Field / Block Details (A-N1-1 · Block One)' });
    for (const text of [
      'Tea field',
      '1998',
      '4ft × 2.5ft',
      '240.00',
      '5.00',
      'TV-1',
      'Rain fed',
      'Loam',
      'Good',
      'manager',
    ]) {
      expect(within(details).getByText(text)).toBeInTheDocument();
    }
  });

  it('filters by field type', async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    await within(table).findByText('A-N1-1', { exact: false });
    await userEvent.click(screen.getByRole('button', { name: /Field type$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Nursery' }));
    await waitFor(() => {
      expect(within(table).queryByText('A-N1-1', { exact: false })).not.toBeInTheDocument();
    });
    expect(within(table).getByText('A-N1-2', { exact: false })).toBeInTheDocument();
  });

  it('shows the figures under the list from the server, by field type', async () => {
    await openAs('manager', '/estates/e1/fields');
    const summary = await screen.findByRole('region', { name: 'Field / Block Summary' });
    await waitFor(async () => {
      expect(await figure(summary, 'Total fields')).toContain('3');
    });
    expect(await figure(summary, 'Tea field')).toContain('2');
    expect(await figure(summary, 'Nursery')).toContain('1');
    expect(await figure(summary, 'Active field')).toContain('3');
    expect(await figure(summary, 'Inactive field')).toContain('0');
  });

  it('opens a field with its details in the form, and saves a change', async () => {
    await openAs('manager', '/fields/f1');
    await screen.findByRole('heading', { level: 1, name: 'A-N1-1' });
    expect(screen.getByText('Created by')).toBeInTheDocument();
    const spacing = await screen.findByRole('textbox', { name: /^Spacing/ });
    expect(spacing).toHaveValue('4ft × 2.5ft');
    expect(screen.getByRole('textbox', { name: /^Altitude/ })).toHaveValue('240.00');
    expect(screen.getByRole('textbox', { name: /^Average slope/ })).toHaveValue('5.00');
    // The bush type, irrigation, soil and drainage the field has are in their lists.
    expect(screen.getByRole('button', { name: /Bush type/ })).toHaveTextContent('TV-1');
    expect(screen.getByRole('button', { name: /Soil type/ })).toHaveTextContent('Loam');

    await userEvent.clear(spacing);
    await userEvent.type(spacing, '3ft × 3ft');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Field saved')).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: /^Spacing/ })).toHaveValue('3ft × 3ft');
  }, 60_000);

  it('checks altitude and slope before sending', async () => {
    await openAs('manager', '/fields/f1');
    const altitude = await screen.findByRole('textbox', { name: /^Altitude/ });
    await userEvent.clear(altitude);
    await userEvent.type(altitude, 'high');
    const slope = screen.getByRole('textbox', { name: /^Average slope/ });
    await userEvent.clear(slope);
    await userEvent.type(slope, '120');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter feet above sea level from -1000 to 30000, with at most two decimals.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter degrees from 0 to 90, with at most two decimals.')).toBeInTheDocument();
  }, 60_000);

  it('puts a block inside another field of the estate', async () => {
    await openAs('manager', '/fields/f1');
    await screen.findByRole('heading', { level: 1, name: 'A-N1-1' });
    await userEvent.click(await screen.findByRole('button', { name: /Parent field/ }));
    // Its own estate's other fields, never itself.
    expect(screen.queryByRole('option', { name: 'A-N1-1 · Block One' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'A-N1-2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Field saved')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Parent field/ })).toHaveTextContent('A-N1-2');
    });
  }, 60_000);
});
