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

/** P2.09 Training (RUP-546): programmes, their participants, and recording attendance and results. */

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

describe('the programmes', () => {
  it('lists them with their state and seats', async () => {
    await openAs('manager', '/hr/training');
    const table = await screen.findByRole('table', { name: 'Training' });
    const row = (await within(table).findByRole('link', { name: 'TP-T2' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('First aid')).toBeInTheDocument();
    expect(within(row).getByText('Planned')).toBeInTheDocument();
    expect(within(row).getByText('1 / 3')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind training.view', async () => {
    await openAs('viewer', '/hr/training');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('planning a programme', () => {
  it('asks for what is missing, then keeps a draft and returns to the list', async () => {
    const router = await openAs('manager', '/hr/training/new');
    await screen.findByRole('heading', { level: 1, name: 'Plan training programme' });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Enter a title of at least 3 characters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Select/ }));
    await userEvent.click((await screen.findAllByRole('option'))[1]!);
    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'Plucking basics');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/training');
    });
  });

  it('deletes a draft and returns to the list', async () => {
    const router = await openAs('manager', '/hr/training/t1');
    await screen.findByRole('heading', { level: 1, name: 'Safe pesticide handling' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete programme TP-T1?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/training');
    });
  });

  it('cancels a programme with a reason', async () => {
    await openAs('manager', '/hr/training/t2');
    await screen.findByRole('heading', { level: 1, name: 'First aid' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel programme' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel programme TP-T2' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel programme' }));
    expect(await within(dialog).findByText(/at least 3/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Trainer unwell');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel programme' }));
    expect(await screen.findByText('Trainer unwell')).toBeInTheDocument();
  });
});

describe('participants and results', () => {
  it('shows who is registered', async () => {
    await openAs('manager', '/hr/training/t2');
    await screen.findByRole('heading', { level: 1, name: 'First aid' });
    expect((await screen.findAllByText('Salma Begum')).length).toBeGreaterThan(0);
    expect(screen.getByText('Registered')).toBeInTheDocument();
  });

  it('will not complete while an attendance is missing', async () => {
    await openAs('manager', '/hr/training/t2');
    await screen.findByRole('heading', { level: 1, name: 'First aid' });
    await userEvent.click(screen.getByRole('button', { name: 'Complete programme' }));
    expect(await screen.findByText(/have no attendance recorded/)).toBeInTheDocument();
  });

  it('refuses a result for someone who did not attend, then saves it once they did', async () => {
    await openAs('manager', '/hr/training/t2');
    await screen.findByRole('heading', { level: 1, name: 'First aid' });
    await userEvent.click(await screen.findByRole('button', { name: /^Record/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Result of Salma Begum' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Not assessed/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Passed' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save result' }));
    expect(
      await within(dialog).findByText('Only someone who attended is assessed or certified.'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /Registered/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Attended' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save result' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Result of Salma Begum' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Attended')).toBeInTheDocument();
  });
});
