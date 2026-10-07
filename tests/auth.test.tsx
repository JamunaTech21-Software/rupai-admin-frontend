import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { setAccessToken } from '@/lib/api';
import { apiError, authMocks, MOCK_PASSWORD, mockSession, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** P1.02 (RUP-75): sign-in refusals, the reset link's fragment token, the account page and its sessions. */

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  setAccessToken(null);
  server.use(...authMocks(BASE));
});

let appRoot: HTMLElement = document.body;

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  appRoot = render(<RouterProvider router={router} />).container;
  return router;
}

async function signIn(username: string, password = MOCK_PASSWORD) {
  await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), username);
  await userEvent.type(screen.getByLabelText(/^Password/), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('sign-in refusals', () => {
  it('a locked account says how many minutes to wait', async () => {
    open('/login');
    await signIn('locked');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many failed sign-ins. Try again in 9 minutes, or ask an administrator.',
    );
  });

  it('a disabled account says to ask an administrator', async () => {
    open('/login');
    await signIn('disabled');
    expect(await screen.findByRole('alert')).toHaveTextContent('This account is disabled.');
  });

  it('rate limiting says how long to wait, from Retry-After', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        apiError(429, 'RATE_LIMITED', 'Too many requests.', [], { 'Retry-After': '30' }),
      ),
    );
    open('/login');
    await signIn('manager');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait 30 seconds and try again.');
  });
});

describe('password reset link', () => {
  it('reads the token from the fragment, removes it from the address, and sends it', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${BASE}/auth/password/reset`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const token = 'a'.repeat(40);
    const router = open(`/reset-password#token=${token}`);
    await screen.findByRole('heading', { name: 'Choose a new password' });
    await waitFor(() => {
      expect(router.state.location.hash).toBe('');
    });
    expect(screen.queryByText('This reset link is incomplete. Ask for a new one.')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^New password/), 'A-New-Password-1');
    await userEvent.type(screen.getByLabelText(/^Confirm new password/), 'A-New-Password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(sent).toEqual({ token, new_password: 'A-New-Password-1' });
  });

  it('without a token it says the link is incomplete', async () => {
    open('/reset-password');
    expect(await screen.findByText('This reset link is incomplete. Ask for a new one.')).toBeInTheDocument();
  });
});

describe('password change required mid-session', () => {
  it('a 403 PASSWORD_CHANGE_REQUIRED from any call sends the user to change it', async () => {
    server.use(
      http.get(`${BASE}/auth/sessions`, () =>
        apiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password to continue.'),
      ),
    );
    const router = open('/account');
    await signIn('manager');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/change-password');
    });
    expect(router.state.location.search).toBe(`?returnTo=${encodeURIComponent('/account')}`);
  });
});

describe('account page', () => {
  it('is in the user menu', async () => {
    const router = open('/');
    await signIn('viewer');
    await userEvent.click(await screen.findByRole('button', { name: /Account: viewer/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Your account' }));
    await screen.findByRole('heading', { level: 1, name: 'Your account' });
    expect(router.state.location.pathname).toBe('/account');
  });

  it('shows the profile and every signed-in device, this one marked', async () => {
    open('/account');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Your account' });
    const devices = await screen.findByRole('region', { name: 'Where you are signed in' });
    expect(await within(devices).findByText('Chrome on Windows')).toBeInTheDocument();
    expect(within(devices).getByText('This device')).toBeInTheDocument();
    expect(within(devices).getByText('Chrome on Android')).toBeInTheDocument();
    expect(within(devices).getByText('Safari on macOS')).toBeInTheDocument();
    // Only the other devices can be signed out from here.
    expect(within(devices).getAllByRole('button', { name: 'Sign out' })).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Profile' })).toHaveTextContent('manager@example.com');
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('signs out one other device', async () => {
    open('/account');
    await signIn('manager');
    const devices = await screen.findByRole('region', { name: 'Where you are signed in' });
    const phone = (await within(devices).findByText('Chrome on Android')).closest('li');
    expect(phone).not.toBeNull();
    await userEvent.click(within(phone as HTMLElement).getByRole('button', { name: 'Sign out' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Sign out of Chrome on Android?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(within(devices).queryByText('Chrome on Android')).not.toBeInTheDocument();
    });
    expect(mockSession.otherSessions.map((row) => row.id)).toEqual(['ses_laptop']);
  });

  it('signs out everywhere, ending this session too', async () => {
    const router = open('/account');
    await signIn('manager');
    const devices = await screen.findByRole('region', { name: 'Where you are signed in' });
    await userEvent.click(within(devices).getByRole('button', { name: 'Sign out everywhere' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Sign out on every device?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sign out everywhere' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(mockSession.signedIn).toBeNull();
    expect(mockSession.otherSessions).toEqual([]);
  });
});
