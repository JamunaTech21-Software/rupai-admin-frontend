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

/** R.3 Field / Block page (RUP-663): the list with its actions, the details beside the map, and the boundary form. */

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

describe('field / block page', () => {
  it('shows the map of the estate and the chosen field with its perimeter and coordinates', async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    expect(
      await screen.findByRole('region', { name: 'Map of the fields of Rupai Hills Tea Estate' }),
    ).toBeInTheDocument();
    await userEvent.click(await within(table).findByRole('button', { name: /Details of A-N1-1/ }));
    expect(await screen.findByText(/Perimeter: 2\.15 km/)).toBeInTheDocument();
    expect(screen.getByText(/Coordinates: 23\.7020, 90\.4020/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Street' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Satellite' }));
    expect(screen.getByRole('button', { name: 'Satellite' })).toHaveAttribute('aria-pressed', 'true');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('says so when the chosen field has no boundary yet, and invents none', async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    await userEvent.click(await within(table).findByRole('button', { name: /Details of A-N2-1/ }));
    expect(await screen.findByText(/has no boundary yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Perimeter:/)).not.toBeInTheDocument();
  });

  it('gives the manager edit and delete icons on every row', async () => {
    await openAs('manager', '/estates/e1/fields');
    const table = await screen.findByRole('table', { name: 'Fields / blocks' });
    expect(await within(table).findByRole('button', { name: /Edit A-N1-1/ })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /Delete A-N1-1/ })).toBeInTheDocument();
  });

  it('reveals the division, section and field status filters behind the filter button', async () => {
    await openAs('manager', '/estates/e1/fields');
    await screen.findByRole('table', { name: 'Fields / blocks' });
    expect(screen.queryByRole('button', { name: /Division$/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More filters' }));
    expect(await screen.findByRole('button', { name: /Division$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Section$/ })).toBeInTheDocument();
  });
});

describe('field boundary', () => {
  it('saves typed GPS points and refuses a bad line', async () => {
    await openAs('manager', '/fields/f3');
    await screen.findByRole('heading', { level: 1, name: 'A-N2-1' });
    const points = await screen.findByRole('textbox', { name: /GPS points/ });
    await userEvent.type(points, 'not a point');
    await userEvent.click(screen.getByRole('button', { name: 'Use these points' }));
    expect(await screen.findByText(/Enter latitude and longitude on each line/)).toBeInTheDocument();
    await userEvent.clear(points);
    await userEvent.click(points);
    await userEvent.paste('23.7001, 90.4002\n23.7011, 90.4002\n23.7011, 90.4012');
    await userEvent.click(screen.getByRole('button', { name: 'Use these points' }));
    await waitFor(() => {
      expect(screen.queryByText(/Enter latitude and longitude on each line/)).not.toBeInTheDocument();
      expect(screen.queryByText('This field has no boundary yet.')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Perimeter')).toBeInTheDocument();
  });

  it('tells a new field to be saved before it can have a boundary', async () => {
    await openAs('manager', '/fields/new');
    expect(await screen.findByText(/Save the field first/)).toBeInTheDocument();
  });
});
