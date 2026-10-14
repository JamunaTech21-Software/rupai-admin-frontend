import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { configurationMocks, resetConfigurationMocks } from '@/features/configuration/api/mocks';
import { exampleNumber, scopeParts } from '@/features/configuration/numbering';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.11 (RUP-213): Admin → Document numbering and Admin → System settings. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  resetConfigurationMocks();
  setAccessToken(null);
  server.use(...authMocks(BASE), ...configurationMocks(BASE));
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

async function rowOf(table: HTMLElement, text: string) {
  const row = (await within(table).findByText(text)).closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
}

async function choose(scope: HTMLElement, select: RegExp, option: string) {
  await userEvent.click(within(scope).getByRole('button', { name: select }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('number rendering', () => {
  it('builds numbers the way the server does', () => {
    const base = {
      prefix: 'PO',
      separator: '-' as const,
      sequence_width: 5,
      reset_frequency: 'yearly' as const,
      include_estate_code: true,
      include_fiscal_year: false,
      include_season: false,
    };
    expect(exampleNumber(base, '2026-10-14')).toBe('PO-EST-2026-00001');
    expect(exampleNumber({ ...base, include_fiscal_year: true }, '2026-10-14', 42)).toBe(
      'PO-EST-FY2026-27-00042',
    );
    expect(exampleNumber({ ...base, reset_frequency: 'monthly', separator: '' }, '2026-10-14')).toBe(
      'POEST20261000001',
    );
    expect(scopeParts('E:EST|FY:FY2026-27')).toEqual([
      { kind: 'estate', value: 'EST' },
      { kind: 'fiscal_year', value: 'FY2026-27' },
    ]);
    expect(scopeParts('*')).toEqual([{ kind: 'all' }]);
  });
});

describe('document numbering', () => {
  it('lists one format per document type, with its example, and is in the sidebar', async () => {
    await openAs('manager', '/admin/numbering');
    await screen.findByRole('heading', { level: 1, name: 'Document numbering' });
    const table = await screen.findByRole('table', { name: 'Document numbering' });
    const journal = await rowOf(table, 'Journal');
    expect(within(journal).getByText('JV-FY2026-27-00001')).toBeInTheDocument();
    expect(within(journal).getByText('At posting, no gaps')).toBeInTheDocument();
    expect(within(await rowOf(table, 'Purchase order')).getByText('At draft')).toBeInTheDocument();
    // The set is the system's: nothing to add.
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Document numbering' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'System settings' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('filters to the gapless documents', async () => {
    await openAs('manager', '/admin/numbering');
    const table = await screen.findByRole('table', { name: 'Document numbering' });
    await rowOf(table, 'Purchase order');
    await choose(screen.getByRole('main'), /Numbered$/, 'At posting, no gaps');
    expect(await within(table).findByText('Sale')).toBeInTheDocument();
    expect(within(table).queryByText('Purchase order')).not.toBeInTheDocument();
  });

  it('edits a format, showing the effect before it is saved', async () => {
    await openAs('manager', '/admin/numbering');
    const table = await screen.findByRole('table', { name: 'Document numbering' });
    await userEvent.click(
      await within(table).findByRole('button', { name: 'Edit numbering of Purchase order' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Numbering of Purchase order' });
    // Only the parts a purchase order can carry are offered.
    expect(within(dialog).getByRole('checkbox', { name: 'Estate code' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Fiscal year' })).not.toBeChecked();
    expect(within(dialog).queryByRole('checkbox', { name: 'Season' })).not.toBeInTheDocument();

    const prefix = within(dialog).getByRole('textbox', { name: /^Prefix/ });
    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'P-O');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Use 1 to 20 letters or digits.')).toBeInTheDocument();

    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'pur');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Fiscal year' }));
    await choose(dialog, /Separator$/, 'Slash (/)');
    const digits = within(dialog).getByRole('textbox', { name: /^Digits/ });
    await userEvent.clear(digits);
    await userEvent.type(digits, '4');
    await userEvent.tab();
    expect(await within(dialog).findByText('PUR/EST/FY2026-27/0001')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText(
        'Numbering of Purchase order saved. Next numbers look like PUR/EST/FY2026-27/0001',
      ),
    ).toBeInTheDocument();
    expect(await within(table).findByText('PUR/EST/FY2026-27/0001')).toBeInTheDocument();
  });

  it('a financial document says it is numbered at posting, and has only the parts it knows', async () => {
    await openAs('manager', '/admin/numbering');
    const table = await screen.findByRole('table', { name: 'Document numbering' });
    await userEvent.click(await within(table).findByRole('button', { name: 'Edit numbering of Journal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Numbering of Journal' });
    expect(within(dialog).getByText(/gets its number when it is posted/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Estate code' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Fiscal year' })).toBeChecked();
  });

  it('shows the next number and the counters of a document type', async () => {
    await openAs('manager', '/admin/numbering');
    const table = await screen.findByRole('table', { name: 'Document numbering' });
    await userEvent.click(await within(table).findByRole('button', { name: 'Counters of Purchase order' }));
    const drawer = await screen.findByRole('dialog', { name: 'Counters of Purchase order' });
    expect(await within(drawer).findByText('PO-EST-2026-00001')).toBeInTheDocument();
    expect(await within(drawer).findByText('Estate EST · Year 2026')).toBeInTheDocument();
    expect(within(drawer).getByText('Last: 41')).toBeInTheDocument();
    expect(await axeViolations(drawer)).toEqual([]);
  });

  it('needs system.view', async () => {
    await openAs('viewer', '/admin/numbering');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('system settings', () => {
  it('lists the settings by group, never showing an encrypted value', async () => {
    await openAs('manager', '/admin/settings');
    await screen.findByRole('heading', { level: 1, name: 'System settings' });
    for (const group of ['attendance', 'integration', 'notifications', 'payroll']) {
      expect(await screen.findByRole('heading', { level: 2, name: group })).toBeInTheDocument();
    }
    const integration = screen.getByRole('list', { name: 'integration' });
    expect(within(integration).getByText('integration.sms_api_key')).toBeInTheDocument();
    expect(within(integration).getByText('••••••• (set)')).toBeInTheDocument();
    expect(within(integration).getByText('Encrypted')).toBeInTheDocument();
    const notifications = screen.getByRole('list', { name: 'notifications' });
    expect(within(notifications).getByText('On')).toBeInTheDocument();
    expect(within(notifications).getByText('RupAi Tea')).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('searches by name and by group', async () => {
    await openAs('manager', '/admin/settings');
    await screen.findByRole('heading', { level: 2, name: 'attendance' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'sms');
    expect(screen.queryByRole('heading', { level: 2, name: 'attendance' })).not.toBeInTheDocument();
    expect(screen.getByText('integration.sms_api_key')).toBeInTheDocument();
    expect(screen.getByText('notifications.sms_enabled')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz');
    expect(await screen.findByText('No settings match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'attendance' })).toBeInTheDocument();
  });

  it('adds a setting, checking the name and the value against its type', async () => {
    await openAs('manager', '/admin/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Add setting' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add setting' });
    const key = within(dialog).getByRole('textbox', { name: /^Name/ });
    await userEvent.type(key, 'Grace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText(/Use lower-case words joined by dots/)).toBeInTheDocument();

    await userEvent.clear(key);
    await userEvent.type(key, 'attendance.grace_minutes');
    await choose(dialog, /Type$/, 'Decimal');
    const value = within(dialog).getByRole('textbox', { name: /^Value/ });
    await userEvent.type(value, '12.5.0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('Enter a number such as 12.50.')).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, '12.50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    // The name is taken: the server says so on the field.
    expect(await within(dialog).findByText('is already in use')).toBeInTheDocument();

    await userEvent.clear(key);
    await userEvent.type(key, 'attendance.late_after_hours');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('attendance.late_after_hours added')).toBeInTheDocument();
    const attendance = screen.getByRole('list', { name: 'attendance' });
    expect(within(attendance).getByText('attendance.late_after_hours')).toBeInTheDocument();
    expect(within(attendance).getByText('12.50')).toBeInTheDocument();
  });

  it('changes a value, and a JSON value must be valid', async () => {
    await openAs('manager', '/admin/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit payroll.rounding' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit payroll.rounding' });
    const value = within(dialog).getByRole('textbox', { name: /^Value/ });
    await userEvent.clear(value);
    await userEvent.type(value, '{{"mode": ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('This is not valid JSON.')).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, '{{"mode": "down"}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('payroll.rounding saved')).toBeInTheDocument();
    expect(await screen.findByText('{"mode":"down"}')).toBeInTheDocument();
  });

  it('replaces an encrypted value without ever showing it', async () => {
    await openAs('manager', '/admin/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit integration.sms_api_key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit integration.sms_api_key' });
    expect(within(dialog).getByRole('radio', { name: 'Keep the stored value' })).toBeChecked();
    expect(within(dialog).queryByLabelText(/^New value/)).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Replace the value' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Enter the new value.')).toBeInTheDocument();
    const secret = within(dialog).getByLabelText(/^New value/);
    expect(secret).toHaveAttribute('type', 'password');
    await userEvent.type(secret, 'new-secret');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('integration.sms_api_key saved')).toBeInTheDocument();
    expect(screen.queryByText('new-secret')).not.toBeInTheDocument();
    expect(screen.getByText('••••••• (set)')).toBeInTheDocument();
  });

  it('says so when the server cannot encrypt', async () => {
    resetConfigurationMocks({ canEncrypt: false });
    await openAs('manager', '/admin/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit integration.sms_api_key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit integration.sms_api_key' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Replace the value' }));
    await userEvent.type(within(dialog).getByLabelText(/^New value/), 'new-secret');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('SETTINGS_ENCRYPTION_KEY is not configured.')).toBeInTheDocument();
  });

  it('deletes a setting after confirming', async () => {
    await openAs('manager', '/admin/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete notifications.sender_name' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete notifications.sender_name?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete setting' }));
    expect(await screen.findByText('notifications.sender_name deleted')).toBeInTheDocument();
    expect(screen.queryByText('RupAi Tea')).not.toBeInTheDocument();
  });

  it('needs system.view', async () => {
    await openAs('viewer', '/admin/settings');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});
