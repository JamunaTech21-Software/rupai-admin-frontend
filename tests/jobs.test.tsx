import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { jobMocks, resetJobMocks } from '@/features/jobs/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.15 (RUP-277): the Jobs list, one job followed live, the running-jobs indicator, and recurring jobs. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetJobMocks();
  setAccessToken(null);
  server.use(...jobMocks(BASE), ...authMocks(BASE));
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

const rowOf = async (table: HTMLElement, text: string) => {
  // A progress bar repeats the job's name for screen readers: any match is in the row.
  const [first] = await within(table).findAllByText(text);
  const row = first?.closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

describe('jobs list', () => {
  it('lists jobs newest first, each with its state and progress', async () => {
    await openAs('manager', '/jobs');
    await screen.findByRole('heading', { level: 1, name: 'Jobs' });
    const table = await screen.findByRole('table', { name: 'Jobs' });
    const running = await rowOf(table, 'Exporting workers');
    expect(within(running).getByText('Running')).toBeInTheDocument();
    expect(within(running).getByText('4 of 10')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Importing fields')).getByText('Failed')).toBeInTheDocument();
    // Queued again after a failed attempt: it says it is retrying.
    expect(within(await rowOf(table, 'Sending reminders')).getByText('Retrying')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Importing workers')).getByText('Partly done')).toBeInTheDocument();
    expect(
      within(await rowOf(table, 'Nightly clean-up')).getByText('Scheduled: nightly-cleanup'),
    ).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters to the failed jobs, the dead-letter list', async () => {
    await openAs('manager', '/jobs');
    const table = await screen.findByRole('table', { name: 'Jobs' });
    await rowOf(table, 'Exporting workers');
    await userEvent.click(screen.getByRole('button', { name: /State$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Failed' }));
    await waitFor(() => {
      expect(within(table).queryByText('Exporting workers')).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'Importing fields' })).toBeInTheDocument();
  });

  it('is open to everyone who is signed in: their own jobs', async () => {
    await openAs('viewer', '/jobs');
    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeInTheDocument();
  });
});

describe('one job', () => {
  it('follows a running job until it completes', async () => {
    await openAs('manager', '/jobs/j_running');
    await screen.findByRole('heading', { level: 1, name: 'Exporting workers' });
    expect(await screen.findByText('7 of 10')).toBeInTheDocument();
    expect(screen.getByText(/the job keeps running/)).toBeInTheDocument();
    // Polled again after a moment: the job ends and the polling stops.
    expect(await screen.findByText('Completed', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('10 of 10')).toBeInTheDocument();
  });

  it('shows why a job failed, and retries it after confirming', async () => {
    await openAs('manager', '/jobs/j_failed');
    await screen.findByRole('heading', { level: 1, name: 'Importing fields' });
    const alert = await screen.findByText('This job failed');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('The file could not be read.')).toBeInTheDocument();
    expect(screen.getByText('Code IMPORT_FAILED')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Retry Importing fields?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Retry job' }));
    expect(await screen.findByText('Job queued again')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('This job failed')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('says when a job waiting to retry will try again, and why it failed last time', async () => {
    await openAs('manager', '/jobs/j_retrying');
    expect(await screen.findByText('Waiting to try again')).toBeInTheDocument();
    expect(screen.getByText(/Attempt 1 of 3 failed/)).toBeInTheDocument();
    expect(screen.getByText('Last error: The mail server did not answer.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows the report of a partly done job and the link to what a completed one made', async () => {
    await openAs('manager', '/jobs/j_partial');
    expect(await screen.findByText('Done in part')).toBeInTheDocument();
    const result = await screen.findByRole('region', { name: 'Result' });
    expect(within(result).getByText('90')).toBeInTheDocument();
    expect(within(result).getByText(/Duplicate employee number/)).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('links to what a completed job produced', async () => {
    await openAs('manager', '/jobs/j_done');
    const result = await screen.findByRole('region', { name: 'Result' });
    expect(within(result).getByRole('link', { name: /Download the result/ })).toHaveAttribute(
      'href',
      '/api/v1/downloads/estates.xlsx',
    );
  });

  it("answers not found for a job that is not the user's", async () => {
    await openAs('manager', '/jobs/nobody-owns-this');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('running-jobs indicator', () => {
  it("lists the user's live jobs in the top bar and opens the job", async () => {
    await openAs('manager', '/');
    const link = await screen.findByRole('link', { name: /Exporting workers/ });
    expect(link).toHaveAttribute('href', '/jobs/j_running');
    expect(link).toHaveTextContent('Exporting workers (40%)');
  });
});

describe('recurring jobs', () => {
  it('lists the tasks and the processes that run them', async () => {
    await openAs('manager', '/admin/schedules');
    await screen.findByRole('heading', { level: 1, name: 'Recurring jobs' });
    const tasks = await screen.findByRole('table', { name: 'Recurring jobs' });
    const nightly = await rowOf(tasks, 'Nightly clean-up');
    expect(within(nightly).getByText('0 1 * * * (Asia/Dhaka)')).toBeInTheDocument();
    expect(within(nightly).getByText('Active')).toBeInTheDocument();
    expect(within(await rowOf(tasks, 'Document expiry check')).getByText('Paused')).toBeInTheDocument();
    const processes = await screen.findByRole('table', { name: 'Processes' });
    expect(within(await rowOf(processes, 'Worker')).getByText('Running')).toBeInTheDocument();
    expect(within(await rowOf(processes, 'Scheduler')).getByText('Not responding')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('pauses and resumes a task', async () => {
    await openAs('manager', '/admin/schedules');
    const tasks = await screen.findByRole('table', { name: 'Recurring jobs' });
    await userEvent.click(await within(tasks).findByRole('button', { name: 'Pause Nightly clean-up' }));
    expect(await screen.findByText('Nightly clean-up paused')).toBeInTheDocument();
    expect(within(await rowOf(tasks, 'Nightly clean-up')).getByText('Paused')).toBeInTheDocument();
    await userEvent.click(within(tasks).getByRole('button', { name: 'Resume Document expiry check' }));
    expect(await screen.findByText('Document expiry check resumed')).toBeInTheDocument();
  });

  it('runs a task now and opens the job it started', async () => {
    const router = await openAs('manager', '/admin/schedules');
    const tasks = await screen.findByRole('table', { name: 'Recurring jobs' });
    await userEvent.click(await within(tasks).findByRole('button', { name: 'Run Nightly clean-up now' }));
    await screen.findByRole('heading', { level: 1, name: 'Nightly clean-up' });
    expect(router.state.location.pathname).toMatch(/^\/jobs\/j_run_/);
  });

  it('starts a failing test job that ends as failed, so Retry can be tried', async () => {
    await openAs('manager', '/admin/schedules');
    await userEvent.click(await screen.findByRole('button', { name: 'Start a failing test job' }));
    await screen.findByRole('heading', { level: 1, name: 'Job system self-test' });
    expect(await screen.findByText('This job failed', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('needs system.view', async () => {
    await openAs('viewer', '/admin/schedules');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
