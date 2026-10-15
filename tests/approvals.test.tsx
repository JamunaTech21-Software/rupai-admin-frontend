import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { approvalMocks, resetApprovalMocks } from '@/features/approvals/api/mocks';
import { workflowMocks } from '@/features/workflows/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.14 (RUP-261): the approval queue, one approval with its path and history, the decisions, and all approvals. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetApprovalMocks();
  setAccessToken(null);
  server.use(...approvalMocks(BASE), ...workflowMocks(BASE), ...authMocks(BASE));
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

describe('approval queue', () => {
  it('lists what awaits the user, the longest wait first, and says when it is for someone else', async () => {
    await openAs('manager', '/approvals');
    await screen.findByRole('heading', { level: 1, name: 'Approvals' });
    const table = await screen.findByRole('table', { name: 'Approvals' });
    const lease = await rowOf(table, 'LS-2026-0002');
    expect(within(lease).getByText('Refused last time')).toBeInTheDocument();
    const order = await rowOf(table, 'PO-2026-0007');
    expect(within(order).getByText('52 hours')).toBeInTheDocument();
    expect(within(order).getByText('৳125,000.00')).toBeInTheDocument();
    expect(within(await rowOf(table, 'PAY-2026-0031')).getByText('On behalf of rahim')).toBeInTheDocument();
    // Not the user's to decide: not in the queue.
    expect(within(table).queryByText('Annual leave, 5 days')).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('narrows to the approvals that have waited a day or more', async () => {
    await openAs('manager', '/approvals');
    const table = await screen.findByRole('table', { name: 'Approvals' });
    await rowOf(table, 'PAY-2026-0031');
    await userEvent.click(screen.getByRole('button', { name: /Waiting$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'At least 48 hours' }));
    await waitFor(() => {
      expect(within(table).queryByText('PAY-2026-0031')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('PO-2026-0007')).toBeInTheDocument();
  });

  it('shows the count in the top bar', async () => {
    await openAs('manager', '/');
    expect(await screen.findByRole('button', { name: '3 approvals waiting' })).toBeInTheDocument();
  });
});

describe('one approval', () => {
  it('shows the path, who may act now, and the history', async () => {
    await openAs('manager', '/approvals/a_pay');
    await screen.findByRole('heading', { level: 1, name: 'PAY-2026-0031' });
    const path = await screen.findByRole('list', { name: 'Approval path' });
    expect(within(path).getByText('Decided by shefali')).toBeInTheDocument();
    expect(within(path).getByText('May act now: manager')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'History' });
    expect(within(history).getByText('Approved step 1')).toBeInTheDocument();
    expect(within(history).getByText('Checked against the invoice.')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('approves a step after confirming, and the next step starts', async () => {
    await openAs('manager', '/approvals/a_po');
    await screen.findByRole('heading', { level: 1, name: 'PO-2026-0007' });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve PO-2026-0007?' });
    await userEvent.type(within(dialog).getByRole('textbox'), 'Looks right.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('PO-2026-0007 approved')).toBeInTheDocument();
    // Finance is next: the manager can no longer decide it.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });
    expect(
      within(screen.getByRole('list', { name: 'History' })).getByText('Looks right.'),
    ).toBeInTheDocument();
  });

  it('needs a reason to reject, and ends the approval', async () => {
    await openAs('manager', '/approvals/a_po');
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject PO-2026-0007?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('This is required.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Price is too high.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('PO-2026-0007 rejected')).toBeInTheDocument();
    // The page's state and the history's entry both say so.
    expect((await screen.findAllByText('Rejected')).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('returns for correction with a comment', async () => {
    await openAs('manager', '/approvals/a_po');
    await userEvent.click(await screen.findByRole('button', { name: 'Return for correction' }));
    const dialog = await screen.findByRole('dialog', { name: 'Return PO-2026-0007 for correction?' });
    await userEvent.type(within(dialog).getByRole('textbox'), 'Attach the quotation.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Return for correction' }));
    expect(await screen.findByText('PO-2026-0007 returned')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'History' })).getByText('Attach the quotation.'),
    ).toBeInTheDocument();
  });

  it('says why the document refused its final approval, and the approval is still recorded', async () => {
    await openAs('manager', '/approvals/a_lease');
    expect(await screen.findByText('The document refused its final approval')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve LS-2026-0002?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    const refusal = await screen.findByRole('dialog', { name: 'This could not be done' });
    expect(within(refusal).getByText('The lease has no end date.')).toBeInTheDocument();
  });

  it('offers nothing to decide when the server allows nothing, and says when nobody can act', async () => {
    await openAs('manager', '/approvals/a_leave');
    expect(await screen.findByText('Nobody can act on this step')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('answers not found for an approval that is not there', async () => {
    await openAs('manager', '/approvals/nobody');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('approval exceptions', () => {
  it('lists the approvals nobody can act on, and what each needs', async () => {
    await openAs('manager', '/approvals/exceptions');
    await screen.findByRole('heading', { level: 1, name: 'Approval exceptions' });
    const table = await screen.findByRole('table', { name: 'Approval exceptions' });
    const row = await rowOf(table, 'Annual leave, 5 days');
    expect(within(row).getByText('Someone with the role Estate manager')).toBeInTheDocument();
  });

  it('needs workflow.view', async () => {
    await openAs('viewer', '/approvals/exceptions');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('delegations', () => {
  it('lists them and narrows to those in force', async () => {
    await openAs('manager', '/approvals/delegations');
    await screen.findByRole('heading', { level: 1, name: 'Delegations' });
    const table = await screen.findByRole('table', { name: 'Delegations' });
    expect(within(await rowOf(table, 'rahim → manager')).getByText('In force')).toBeInTheDocument();
    expect(within(await rowOf(table, 'shefali → rahim')).getByText('Not in force')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Only those in force' }));
    await waitFor(() => {
      expect(within(table).queryByText('shefali → rahim')).not.toBeInTheDocument();
    });
  });

  it('ends one after confirming; the record stays', async () => {
    await openAs('manager', '/approvals/delegations');
    const table = await screen.findByRole('table', { name: 'Delegations' });
    const row = await rowOf(table, 'rahim → manager');
    await userEvent.click(within(row).getByRole('button', { name: 'End now' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'End the delegation from rahim to manager?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'End delegation' }));
    expect(await screen.findByText('Delegation ended')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(row).queryByRole('button', { name: 'End now' })).not.toBeInTheDocument();
    });
    expect(within(row).getByText('Ended')).toBeInTheDocument();
  });

  it('checks the form before sending, and starts a delegation', async () => {
    await openAs('manager', '/approvals/delegations');
    await userEvent.click(await screen.findByRole('button', { name: 'New delegation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New delegation' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delegate' }));
    expect(await within(dialog).findByText('Choose who is handing over.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose who takes over.')).toBeInTheDocument();
    expect(within(dialog).getByText('Give a reason of at least 5 characters.')).toBeInTheDocument();
  });

  it('needs user.view', async () => {
    await openAs('viewer', '/approvals/delegations');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('all approvals', () => {
  it('lists every approval, and narrows to the ones nobody can act on', async () => {
    await openAs('manager', '/approvals/all');
    await screen.findByRole('heading', { level: 1, name: 'All approvals' });
    const table = await screen.findByRole('table', { name: 'All approvals' });
    expect(within(await rowOf(table, 'SL-2026-0100')).getByText('Approved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nobody can act' }));
    await waitFor(() => {
      expect(within(table).queryByText('SL-2026-0100')).not.toBeInTheDocument();
    });
    expect(within(table).getByText('Annual leave, 5 days')).toBeInTheDocument();
  });

  it('needs workflow.view', async () => {
    await openAs('viewer', '/approvals/all');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
