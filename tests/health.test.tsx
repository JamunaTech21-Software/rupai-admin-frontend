import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { healthMocks } from '@/features/health/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.18 (RUP-325): the system health page. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  setAccessToken(null);
  server.use(...healthMocks(BASE), ...authMocks(BASE));
});

let appRoot: HTMLElement = document.body;

async function openAs(username: string, path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  appRoot = render(<RouterProvider router={router} />).container;
  await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), username);
  await userEvent.type(screen.getByLabelText(/^Password/), MOCK_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const card = (label: string) => {
  const item = screen.getByRole('heading', { level: 3, name: label }).closest('li');
  if (!item) throw new Error(`no card for ${label}`);
  return item;
};

describe('system health', () => {
  it('shows the overall status, each check with its status and value, and the version', async () => {
    await openAs('manager', '/admin/health');
    await screen.findByRole('heading', { level: 1, name: 'System health' });
    expect(await screen.findByText('Something is wrong')).toBeInTheDocument();
    expect(screen.getByText('2 checks need attention.')).toBeInTheDocument();
    const database = card('Database');
    expect(within(database).getByText('Healthy')).toBeInTheDocument();
    expect(within(database).getByText('3 ms')).toBeInTheDocument();
    expect(within(card('Failed jobs')).getByText('Needs a look')).toBeInTheDocument();
    expect(within(card('Scheduler')).getByText('Critical')).toBeInTheDocument();
    expect(within(card('Backup')).getByText('Could not be read')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('1 h 5 min')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('links a check to the page that has more on it', async () => {
    await openAs('manager', '/admin/health');
    await screen.findByRole('heading', { level: 1, name: 'System health' });
    expect(within(card('Failed jobs')).getByRole('link', { name: 'Look into Failed jobs' })).toHaveAttribute(
      'href',
      '/jobs?filter%5Bstate%5D=failed',
    );
    expect(within(card('Scheduler')).getByRole('link', { name: 'Look into Scheduler' })).toHaveAttribute(
      'href',
      '/admin/schedules',
    );
  });

  it('groups the checks that start later, muted and without a link', async () => {
    await openAs('manager', '/admin/health');
    await screen.findByRole('heading', { level: 1, name: 'System health' });
    expect(screen.getByRole('heading', { level: 2, name: 'Later' })).toBeInTheDocument();
    const later = card('Consistency checks');
    expect(within(later).getByText('Not yet')).toBeInTheDocument();
    expect(within(later).queryByRole('link')).not.toBeInTheDocument();
  });

  it('refreshes on request', async () => {
    await openAs('manager', '/admin/health');
    await screen.findByRole('heading', { level: 1, name: 'System health' });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('needs system.view', async () => {
    await openAs('viewer', '/admin/health');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
