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

/** P2.03 Employment assignments (RUP-450): the timeline, a change in terms, and the approval it may wait for. */

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

async function choose(scope: HTMLElement, button: RegExp | string, option: string) {
  await userEvent.click(await within(scope).findByRole('button', { name: button }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

const open = async (path = '/workforce/profiles/pr2?tab=assignments') => {
  const router = await openAs('manager', path);
  await screen.findByRole('heading', { level: 2, name: 'Assignments' });
  return router;
};

describe('assignments timeline', () => {
  it('shows what is in force, where and on what terms', async () => {
    await open();
    expect(await screen.findByText('North 1 · Plucking')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Joining')).toBeInTheDocument();
    expect(screen.getByText(/Daily · Rate/)).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('opens the Assignments tab from its own address', async () => {
    await openAs('manager', '/workforce/profiles/pr2/assignments');
    expect(await screen.findByRole('heading', { level: 2, name: 'Assignments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assignments' })).toHaveAttribute('aria-selected', 'true');
  });

  it('asks for the first assignment when there is none, and for a section and a job', async () => {
    await open('/workforce/profiles/pr3?tab=assignments');
    expect(await screen.findByText('No assignment yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add first assignment' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit change' }));
    expect(await within(dialog).findByText('Choose the section.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the job / task.')).toBeInTheDocument();
  });
});

describe('changes', () => {
  it('puts a transfer in effect at once and closes the earlier assignment', async () => {
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'New change' }));
    const dialog = await screen.findByRole('dialog');
    await choose(dialog, /Section/, 'N2 · North 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit change' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('North 2 · Plucking')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getAllByText('Approved')).toHaveLength(2);
    expect(screen.getAllByText('Current')).toHaveLength(1);
  });

  it('sends a wage revision for approval and allows no second change meanwhile', async () => {
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'New change' }));
    const dialog = await screen.findByRole('dialog');
    await choose(dialog, /Reason for the change/, 'Wage revision');
    const rate = within(dialog).getByRole('textbox', { name: /Base rate/ });
    await userEvent.clear(rate);
    await userEvent.type(rate, '600');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit change' }));
    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the approval' })).toHaveAttribute('href', '/approvals/ap1');
    expect(screen.getByRole('button', { name: 'New change' })).toBeDisabled();
    expect(screen.getByText(/A change is already pending/)).toBeInTheDocument();
  });

  it('keeps a draft, then changes it, submits it or deletes it', async () => {
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'New change' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    const row = screen.getByText('Draft').closest('li');
    if (!row) throw new Error('no row');
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this draft?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'New change' })).toBeEnabled();
  });
});
