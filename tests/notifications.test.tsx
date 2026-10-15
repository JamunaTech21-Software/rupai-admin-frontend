import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { notificationMocks, resetNotificationMocks } from '@/features/notifications/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.16 (RUP-293): the bell, the list with its views, mark read and dismiss, and the notification rules. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetNotificationMocks();
  setAccessToken(null);
  server.use(...notificationMocks(BASE), ...authMocks(BASE));
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
  // The name is also the event's label in another column: the first match is the name.
  const [first] = await within(table).findAllByText(text);
  const row = first?.closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

describe('the bell', () => {
  it('shows how many are unread, and opens a panel with the newest', async () => {
    await openAs('manager', '/');
    const bell = await screen.findByRole('button', { name: '2 unread notifications' });
    await userEvent.click(bell);
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(await within(panel).findByText('Approval needed: PO-2026-0007')).toBeInTheDocument();
    expect(within(panel).getByText('Licence expires in 10 days')).toBeInTheDocument();
    // Dismissed ones are not in it.
    expect(within(panel).queryByText('Approval needed: PAY-2026-0031')).not.toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('opening one marks it read, goes to what it is about and closes the panel', async () => {
    const router = await openAs('manager', '/');
    await userEvent.click(await screen.findByRole('button', { name: '2 unread notifications' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await userEvent.click(await within(panel).findByText('Approval needed: PO-2026-0007'));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/approvals/12');
    });
    expect(await screen.findByRole('button', { name: '1 unread notification' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('marks everything read', async () => {
    await openAs('manager', '/');
    await userEvent.click(await screen.findByRole('button', { name: '2 unread notifications' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await within(panel).findByText('Approval needed: PO-2026-0007');
    await userEvent.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByText('2 notifications marked as read')).toBeInTheDocument();
    // The panel is still open over the page, so the bell is outside what a screen reader sees.
    expect(await screen.findByRole('button', { name: 'Notifications', hidden: true })).toBeInTheDocument();
  });
});

describe('notifications list', () => {
  it('lists the newest first, with the unread ones marked, and leaves out the dismissed', async () => {
    await openAs('manager', '/notifications');
    await screen.findByRole('heading', { level: 1, name: 'Notifications' });
    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(await within(list).findByText('Licence expires in 10 days')).toBeInTheDocument();
    expect(within(list).getByText('Critical')).toBeInTheDocument();
    expect(within(list).queryByText('Approval needed: PAY-2026-0031')).not.toBeInTheDocument();
    expect(within(list).getAllByText('New')).toHaveLength(2);
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('shows only the unread in the Unread view', async () => {
    await openAs('manager', '/notifications');
    await screen.findByText('Access review found 2 conflicts');
    await userEvent.click(screen.getByRole('tab', { name: /Unread/ }));
    await waitFor(() => {
      expect(screen.queryByText('Access review found 2 conflicts')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Licence expires in 10 days')).toBeInTheDocument();
  });

  it('dismisses one, finds it under Dismissed, and restores it', async () => {
    await openAs('manager', '/notifications');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Dismiss "Access review found 2 conflicts"' }),
    );
    await waitFor(() => {
      expect(screen.queryByText('Access review found 2 conflicts')).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Dismissed' }));
    expect(await screen.findByText('Access review found 2 conflicts')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore "Access review found 2 conflicts"' }));
    await waitFor(() => {
      expect(screen.queryByText('Access review found 2 conflicts')).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(await screen.findByText('Access review found 2 conflicts')).toBeInTheDocument();
  });

  it('marks one as unread again', async () => {
    await openAs('manager', '/notifications');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark "Access review found 2 conflicts" as unread' }),
    );
    await waitFor(() => {
      expect(screen.getAllByText('New')).toHaveLength(3);
    });
  });

  it('narrows by importance', async () => {
    await openAs('manager', '/notifications');
    await screen.findByText('Access review found 2 conflicts');
    await userEvent.click(screen.getByRole('button', { name: /Importance$/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Warning' }));
    await waitFor(() => {
      expect(screen.queryByText('Licence expires in 10 days')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Access review found 2 conflicts')).toBeInTheDocument();
  });
});

describe('notification rules', () => {
  it('lists them, and says which event is not active yet', async () => {
    await openAs('manager', '/admin/notification-rules');
    await screen.findByRole('heading', { level: 1, name: 'Notification rules' });
    const table = await screen.findByRole('table', { name: 'Notification rules' });
    const expiry = await rowOf(table, 'Document expiring');
    expect(within(expiry).getByText('30 days')).toBeInTheDocument();
    expect(within(expiry).getByText('Active')).toBeInTheDocument();
    const stock = await rowOf(table, 'Low stock');
    expect(within(stock).getByText('Not active until Inventory')).toBeInTheDocument();
    expect(within(stock).getByText('Off')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('changes a rule with the version it was read at', async () => {
    await openAs('manager', '/admin/notification-rules');
    const table = await screen.findByRole('table', { name: 'Notification rules' });
    await rowOf(table, 'Document expiring');
    await userEvent.click(screen.getByRole('button', { name: 'Edit Document expiring' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Document expiring' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Licence expiring');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Licence expiring saved')).toBeInTheDocument();
    expect(await within(table).findByText('Licence expiring')).toBeInTheDocument();
  });

  it('checks the form before adding, and adds a rule', async () => {
    await openAs('manager', '/admin/notification-rules');
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a notification rule' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add rule' }));
    expect(await within(dialog).findByText('Give the rule a code.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the event.')).toBeInTheDocument();
    expect(within(dialog).getByText('Give the rule a name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose who is told.')).toBeInTheDocument();
  });

  it('puts the server message on the code when it is already used', async () => {
    await openAs('manager', '/admin/notification-rules');
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a notification rule' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'doc_expiry');
    await userEvent.click(within(dialog).getByRole('button', { name: /Event/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Approval pending' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Another');
    await userEvent.click(within(dialog).getByRole('button', { name: /Who is told/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'The approvers' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add rule' }));
    expect(await within(dialog).findByText('That code is already in use.')).toBeInTheDocument();
  });

  it('needs notification.view', async () => {
    await openAs('viewer', '/admin/notification-rules');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
