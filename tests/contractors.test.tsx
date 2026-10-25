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

/** P2.05 Contractors (RUP-482): the list, the form, contracts with their approval, labour, and blacklisting. */

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

async function choose(scope: HTMLElement | typeof screen, button: RegExp | string, option: string) {
  const root = scope === screen ? screen : within(scope as HTMLElement);
  await userEvent.click(await root.findByRole('button', { name: button }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** Types a date into a date field's segments (month, day, year in that order). */
async function typeDate(group: HTMLElement, digits: string) {
  await userEvent.click(within(group).getByRole('spinbutton', { name: /month/i }));
  await userEvent.keyboard(digits);
}

describe('contractors list', () => {
  it('shows the cards, the contractors and the expiry alerts', async () => {
    await openAs('manager', '/workforce/contractors');
    const table = await screen.findByRole('table', { name: 'Contractor management' });
    const row = (await within(table).findByRole('link', { name: 'CON-0001' })).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('M/S Green Leaf Services')).toBeInTheDocument();
    expect(within(row).getByText('Labour supply')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Total contractors').closest('div')?.textContent).toContain('2');
    });
    expect(await screen.findByRole('heading', { name: 'Contract expiry alerts' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('searches and says so when nobody matches', async () => {
    await openAs('manager', '/workforce/contractors');
    const table = await screen.findByRole('table', { name: 'Contractor management' });
    await within(table).findByRole('link', { name: 'CON-0001' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'Rahim');
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'CON-0001' })).not.toBeInTheDocument();
    });
    expect(within(table).getByRole('link', { name: 'CON-0002' })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nobody-here');
    expect(await screen.findByText('No contractor matches')).toBeInTheDocument();
  });

  it('is behind contractor.view', async () => {
    await openAs('viewer', '/workforce/contractors');
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
  });
});

describe('add contractor', () => {
  it('asks for what is missing, then registers the contractor and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/contractors/new');
    await screen.findByRole('heading', { level: 1, name: 'Add new contractor' });
    await userEvent.click(screen.getByRole('button', { name: 'Save contractor' }));
    expect((await screen.findAllByText('This is required.')).length).toBeGreaterThan(3);

    await userEvent.type(screen.getByRole('textbox', { name: /^Contractor name/ }), 'Surma Services');
    await choose(screen, /Trade/, 'Labour supply');
    await userEvent.type(screen.getByRole('textbox', { name: /^Mobile no\./ }), '+8801711000200');
    await userEvent.type(screen.getByRole('textbox', { name: /^Address/ }), 'Sreemangal');
    await userEvent.type(screen.getByRole('textbox', { name: /^District/ }), 'Moulvibazar');
    await userEvent.type(screen.getByRole('textbox', { name: /^Contact person name/ }), 'Anwar');
    await userEvent.type(screen.getByRole('textbox', { name: /^Contact person mobile/ }), '+8801711000201');
    await userEvent.type(screen.getByRole('textbox', { name: /^Trade licence no\./ }), 'TL-200');
    await userEvent.type(screen.getByRole('textbox', { name: /^Bank name/ }), 'Sonali Bank');
    await userEvent.type(screen.getByRole('textbox', { name: /^Branch name/ }), 'Sreemangal');
    await userEvent.type(screen.getByRole('textbox', { name: /^Account name/ }), 'Surma Services');
    await userEvent.type(screen.getByRole('textbox', { name: /^Account no\./ }), '200300400');
    await userEvent.type(screen.getByRole('textbox', { name: /^Emergency contact name/ }), 'Rina');
    await choose(screen, /Relation/, 'Spouse');
    await userEvent.type(screen.getByRole('textbox', { name: /^Emergency mobile no\./ }), '+8801711000202');
    await userEvent.click(screen.getByRole('button', { name: 'Save contractor' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/contractors');
    });
    const table = await screen.findByRole('table', { name: 'Contractor management' });
    expect(await within(table).findByText('Surma Services')).toBeInTheDocument();
  });
});

describe('contractor page', () => {
  it('saves a change and returns to the list', async () => {
    const router = await openAs('manager', '/workforce/contractors/c1');
    await screen.findByRole('heading', { level: 1, name: 'M/S Green Leaf Services' });
    const short = await screen.findByRole('textbox', { name: /^Short name/ });
    await userEvent.type(short, 'GLS');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workforce/contractors');
    });
  });

  it('blacklists with a reason, after which it can only be looked at', async () => {
    await openAs('manager', '/workforce/contractors/c1');
    await screen.findByRole('heading', { level: 1, name: 'M/S Green Leaf Services' });
    await userEvent.click(screen.getByRole('button', { name: 'Blacklist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Blacklist M/S Green Leaf Services?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Blacklist' }));
    expect(await within(dialog).findByText('Give a reason of at least 3 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Left work unfinished');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Blacklist' }));
    expect(await screen.findByText('This contractor is blacklisted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});

describe('contracts and labour', () => {
  it('lists the contracts with their status', async () => {
    await openAs('manager', '/workforce/contractors/c1?tab=contracts');
    expect((await screen.findAllByText('CTR-K1')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Labour \(2\)/ })).toBeInTheDocument();
  });

  it('sends a draft contract for approval', async () => {
    await openAs('manager', '/workforce/contractors/c2?tab=contracts');
    await screen.findAllByText('CTR-K2');
    await userEvent.click(screen.getByRole('button', { name: /^Submit for approval/ }));
    expect(await screen.findByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/approvals/ap-k',
    );
    expect(screen.getByText('Waiting for approval.')).toBeInTheDocument();
  });

  it('drafts a new contract', async () => {
    await openAs('manager', '/workforce/contractors/c1?tab=contracts');
    await userEvent.click(await screen.findByRole('button', { name: 'New contract' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save as draft' }));
    expect((await within(dialog).findAllByText('This is required.')).length).toBeGreaterThan(2);
    await choose(dialog, /Kind of work/, 'Plucking');
    await choose(dialog, /Rate basis/, 'Per day');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Rate/ }), '600');
    await typeDate(within(dialog).getByRole('group', { name: /^Contract start date/ }), '01012027');
    await typeDate(within(dialog).getByRole('group', { name: /^Contract end date/ }), '12312027');
    expect(within(dialog).getByRole('textbox', { name: /^Contract duration/ })).toHaveValue('12 months');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Pending')).toBeInTheDocument();
  });

  it('adds and removes labour on a contract', async () => {
    await openAs('manager', '/workforce/contractors/c1?tab=contracts');
    await userEvent.click(await screen.findByRole('button', { name: /Labour \(2\)/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Labour on CTR-K1' });
    expect((await within(dialog).findAllByText('Abdul Karim')).length).toBeGreaterThan(0);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Salim Mia');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add labourer' }));
    expect((await within(dialog).findAllByText('Salim Mia')).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/L-0003/)).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove Salim Mia (entered in error)' }),
    );
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Salim Mia?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(within(dialog).queryAllByText('Salim Mia')).toHaveLength(0);
    });
  });

  it('terminates an approved contract with a last day and a reason', async () => {
    await openAs('manager', '/workforce/contractors/c1?tab=contracts');
    await userEvent.click(await screen.findByRole('button', { name: /^Terminate/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Terminate CTR-K1' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(await within(dialog).findByText('Give a reason of at least 3 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Work finished early');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(await screen.findByText(/Terminated on/)).toBeInTheDocument();
  });
});
