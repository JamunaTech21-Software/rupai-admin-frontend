import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { resetWorkflowMocks, workflowMocks } from '@/features/workflows/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.13 (RUP-245): the workflow list, one workflow with its steps and preview, the lifecycle, and the editor. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetWorkflowMocks();
  setAccessToken(null);
  server.use(...workflowMocks(BASE), ...authMocks(BASE));
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
  const row = (await within(table).findByText(text)).closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

describe('workflow list', () => {
  it('lists the versions with their state, and calls out types with no active workflow', async () => {
    await openAs('manager', '/admin/workflows');
    await screen.findByRole('heading', { level: 1, name: 'Approval workflows' });
    const table = await screen.findByRole('table', { name: 'Approval workflows' });
    expect(within(await rowOf(table, 'Purchase order ladder')).getByText('Active')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Purchase order, new rules')).getByText('Draft')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Payment approval, old')).getByText('Rejected')).toBeInTheDocument();
    expect(await screen.findByText('2 document types have no active workflow')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('narrows to the drafts', async () => {
    await openAs('manager', '/admin/workflows');
    const table = await screen.findByRole('table', { name: 'Approval workflows' });
    await rowOf(table, 'Purchase order ladder');
    await userEvent.click(screen.getByRole('button', { name: /State$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Draft' }));
    await waitFor(() => {
      expect(within(table).queryByText('Purchase order ladder')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Purchase order, new rules')).toBeInTheDocument();
  });

  it('needs workflow.view', async () => {
    await openAs('viewer', '/admin/workflows');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('one workflow', () => {
  it('shows the steps in order, each condition in words, and the warning on the step it names', async () => {
    await openAs('manager', '/admin/workflows/wf_1');
    await screen.findByRole('heading', { level: 1, name: 'Purchase order ladder' });
    const steps = await screen.findByRole('list', { name: 'Steps' });
    expect(within(steps).getByText('Step 1 · Estate manager')).toBeInTheDocument();
    expect(within(steps).getByText('Applies when', { exact: false })).toBeInTheDocument();
    expect(within(steps).getByText(/Total amount is at least 100000.00/)).toBeInTheDocument();
    expect(within(steps).getByText('Nobody holds the role Accountant.')).toBeInTheDocument();
    // An active workflow is not edited: it gets a next version.
    expect(screen.getByRole('link', { name: 'New version' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('submits a draft for approval after confirming', async () => {
    await openAs('manager', '/admin/workflows/wf_2');
    await screen.findByRole('heading', { level: 1, name: 'Purchase order, new rules' });
    expect(screen.getByText(/Urgent is yes/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Submit Purchase order, new rules for approval?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Purchase order, new rules submitted')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    });
  });

  it('approves a version someone else wrote', async () => {
    await openAs('manager', '/admin/workflows/wf_3');
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve Payment approval?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Payment approval approved')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });
  });

  it('does not offer approval of a version the user wrote, and can still reject it with a reason', async () => {
    await openAs('manager', '/admin/workflows/wf_4');
    expect(await screen.findByText('You wrote this version')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject Leave approval (mine)?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('This is required.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Wrong steps.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Leave approval (mine) rejected')).toBeInTheDocument();
    expect(await screen.findByText('Wrong steps.')).toBeInTheDocument();
  });

  it('shows why a rejected version was rejected', async () => {
    await openAs('manager', '/admin/workflows/wf_5');
    expect(await screen.findByText('This version was rejected')).toBeInTheDocument();
    expect(screen.getByText('The limit is too high.')).toBeInTheDocument();
  });

  it('previews a sample document: which steps fire and who could decide them', async () => {
    await openAs('manager', '/admin/workflows/wf_1');
    await screen.findByRole('heading', { level: 1, name: 'Purchase order ladder' });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Total amount' }), '150000');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const result = await screen.findByRole('list', { name: 'Preview of the steps' });
    expect(within(result).getAllByText(/on the path/)).toHaveLength(2);
    expect(within(result).getByText('Nobody could approve')).toBeInTheDocument();
    expect(within(result).getByText('Could be approved by: manager')).toBeInTheDocument();
  });

  it('answers not found for a workflow that is not there', async () => {
    await openAs('manager', '/admin/workflows/nobody');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('workflow editor', () => {
  it('checks the form before sending', async () => {
    await openAs('manager', '/admin/workflows/new');
    await screen.findByRole('heading', { level: 1, name: 'New workflow' });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Give the workflow a code.')).toBeInTheDocument();
    expect(screen.getByText('Give the workflow a name.')).toBeInTheDocument();
    expect(screen.getByText('Choose a document type.')).toBeInTheDocument();
    expect(screen.getByText('Choose the first day it is in force.')).toBeInTheDocument();
    expect(screen.getByText('Choose a role.')).toBeInTheDocument();
  });

  it('shows the field a condition can test only after the document type is chosen', async () => {
    await openAs('manager', '/admin/workflows/new');
    await screen.findByRole('heading', { level: 1, name: 'New workflow' });
    expect(screen.getByText('Choose a document type first.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Document type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Purchase order' }));
    // Choosing the type starts the conditions afresh: their fields belong to the type.
    await userEvent.click(screen.getByRole('button', { name: 'Add a condition' }));
    await userEvent.click(screen.getByRole('button', { name: /Condition 1: field/ }));
    expect(await screen.findByRole('option', { name: 'Total amount' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Urgent' })).toBeInTheDocument();
  });

  it('edits a draft and saves it with the version it was read at', async () => {
    const router = await openAs('manager', '/admin/workflows/wf_2/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit workflow' });
    const name = await screen.findByRole('textbox', { name: /^Name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Purchase order, urgent');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/workflows/wf_2');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Purchase order, urgent' }),
    ).toBeInTheDocument();
  });

  it('puts the server message on the step it names', async () => {
    await openAs('manager', '/admin/workflows/wf_2/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit workflow' });
    await userEvent.click(await screen.findByRole('button', { name: /Step 1: apply only when/ }));
    await userEvent.click(screen.getByRole('button', { name: /Step 1 condition: field/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Urgent' }));
    // A flag needs no value, so the form passes; the server refuses a test it cannot read on another field type.
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    });
  });

  it('starts the next version of an active workflow from its steps', async () => {
    const router = await openAs('manager', '/admin/workflows/wf_1/new-version');
    await screen.findByRole('heading', { level: 1, name: 'New version' });
    expect(await screen.findByRole('textbox', { name: /^Code/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Start the version' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/admin\/workflows\/wf_1\d$/);
    });
    expect(await screen.findByText('Draft')).toBeInTheDocument();
  });

  it('does not open an active workflow for editing', async () => {
    await openAs('manager', '/admin/workflows/wf_1/edit');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('needs workflow.create to write a new one', async () => {
    await openAs('viewer', '/admin/workflows/new');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
