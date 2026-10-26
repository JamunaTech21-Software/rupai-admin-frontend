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

/** P2.10 Goals & evaluations (RUP-562): goals with their progress, and evaluations scored, approved, acknowledged. */

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

describe('the goals', () => {
  it('shows the figures and lists the goals with their state', async () => {
    await openAs('manager', '/hr/goals');
    const table = await screen.findByRole('table', { name: 'Goals' });
    await waitFor(() => {
      expect(within(table).getByRole('link', { name: 'GL-G2' })).toBeInTheDocument();
      expect(within(table).getByText('Cut wastage by 5%')).toBeInTheDocument();
      expect(within(table).getByText('In progress')).toBeInTheDocument();
    });
    expect(screen.getByText('All goals')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind goal.view', async () => {
    await openAs('viewer', '/hr/goals');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });

  it('asks for what is missing before a goal is saved', async () => {
    await openAs('manager', '/hr/goals/new');
    await screen.findByRole('heading', { level: 1, name: 'Set a goal' });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Enter the goal in at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Choose the person.')).toBeInTheDocument();
  });
});

describe('the evaluations', () => {
  it('lists them with their score, rating and state', async () => {
    await openAs('manager', '/hr/evaluations');
    const table = await screen.findByRole('table', { name: 'Evaluations' });
    const row = await within(table).findByRole('link', { name: 'EV-V2' });
    expect(row).toBeTruthy();
    expect(within(table).getByText('Exceeds expectations')).toBeInTheDocument();
    expect(within(table).getByText('Approved')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('is behind evaluation.view', async () => {
    await openAs('viewer', '/hr/evaluations');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });

  it('asks who is being evaluated before a new one is saved', async () => {
    await openAs('manager', '/hr/evaluations/new');
    await screen.findByRole('heading', { level: 1, name: 'New evaluation' });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Choose who is being evaluated.')).toBeInTheDocument();
    expect(screen.getAllByText('This is required.').length).toBeGreaterThan(0);
  });

  it('refuses to send a draft with a criterion left unscored', async () => {
    await openAs('manager', '/hr/evaluations/v1');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    expect(
      (await screen.findAllByText('Score every criterion before sending it for approval.')).length,
    ).toBeGreaterThan(0);
  });

  it('scores a draft, sends it for approval and returns to the list', async () => {
    const router = await openAs('manager', '/hr/evaluations/v1');
    await screen.findByRole('heading', { level: 1, name: 'Salma Begum' });
    for (const input of await screen.findAllByRole('textbox', { name: /^Score/ })) {
      await userEvent.type(input, '4');
      await userEvent.tab();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/hr/evaluations');
    });
  });

  it('lets the employee acknowledge an approved evaluation, after which it is locked', async () => {
    await openAs('manager', '/hr/evaluations/v2');
    await screen.findByRole('heading', { level: 1, name: 'Jalal Mia' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Your comment' }), 'Thank you');
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Acknowledged by the employee')).toBeInTheDocument();
    expect(screen.getByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send for approval' })).not.toBeInTheDocument();
  });
});
