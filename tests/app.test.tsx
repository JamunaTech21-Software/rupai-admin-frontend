import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApplicationLayout } from '@/app/layouts';
import { RequireAuth } from '@/app/guards';
import { RootLayout } from '@/app/RootLayout';
import { contained, routes } from '@/app/routes';
import { setAccessToken } from '@/lib/api';
import { setLanguage } from '@/lib/i18n';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

const BASE = 'http://localhost/api/v1';

beforeEach(() => {
  resetMockSession();
  setAccessToken(null);
  server.use(...authMocks(BASE));
});
afterEach(async () => {
  await act(() => setLanguage('en'));
});

/** The app's own root element, for axe (React Aria's live announcer lives outside it, in <body>). */
let appRoot: HTMLElement = document.body;

function renderApp(path: string, tree: RouteObject[] = routes) {
  const router = createMemoryRouter(tree, { initialEntries: [path] });
  appRoot = render(<RouterProvider router={router} />).container;
  return router;
}

async function signIn(username: string) {
  await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), username);
  await userEvent.type(screen.getByLabelText(/^Password/), MOCK_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const sidebar = () => screen.getByRole('navigation', { name: 'Main' });

describe('authentication', () => {
  it('an unauthenticated visit redirects to sign in with a return URL, and returns there after', async () => {
    const router = renderApp('/admin/users?tab=active');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?returnTo=${encodeURIComponent('/admin/users?tab=active')}`);

    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    expect(router.state.location.pathname).toBe('/admin/users');
    expect(router.state.location.search).toBe('?tab=active');
  });

  it('shows the server’s refusal for wrong credentials', async () => {
    renderApp('/login');
    await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), 'manager');
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The username or password is not correct.');
  });

  it('a returning user with a session cookie goes straight in (refresh → /auth/me)', async () => {
    renderApp('/login');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    // A reload forgets the in-memory token; the refresh cookie (mock session) brings the user back.
    setAccessToken(null);
    renderApp('/');
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Dashboard' })).length).toBeGreaterThan(
      0,
    );
  });

  it('a temporary password must be changed first, then the user continues', async () => {
    const router = renderApp('/admin/users');
    await signIn('trainee');
    await screen.findByRole('heading', { name: 'Change your password' });
    expect(router.state.location.pathname).toBe('/change-password');

    await userEvent.type(screen.getByLabelText(/^Current password/), MOCK_PASSWORD);
    await userEvent.type(screen.getByLabelText(/^New password/), 'A-new-password-2026');
    await userEvent.type(screen.getByLabelText(/^Confirm new password/), 'A-new-password-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByRole('heading', { level: 1, name: 'Users' });
  });

  it('signing out returns to sign in and the app is closed again', async () => {
    const router = renderApp('/login');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    await userEvent.click(screen.getByRole('button', { name: /Account: manager/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    await act(() => router.navigate('/'));
    await screen.findByRole('heading', { name: 'Sign in' });
  });
});

describe('permissions', () => {
  it('a user without a permission sees no sidebar entry for it', async () => {
    renderApp('/login');
    await signIn('viewer');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(within(sidebar()).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(within(sidebar()).queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('a user with the permission sees it', async () => {
    renderApp('/login');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(within(sidebar()).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    expect(within(sidebar()).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  });

  it('the route guard answers 403 for a page the user may not open, keeping the address', async () => {
    const router = renderApp('/login?returnTo=%2Fadmin%2Froles');
    await signIn('viewer');
    await screen.findByRole('heading', { name: 'You do not have access to this page' });
    expect(router.state.location.pathname).toBe('/admin/roles');
    expect(sidebar()).toBeInTheDocument();
  });
});

describe('error containment', () => {
  function Boom(): never {
    throw new Error('render failed');
  }

  it('a thrown render error is contained to its route; the shell keeps working', async () => {
    const tree: RouteObject[] = [
      {
        path: '/',
        Component: RootLayout,
        children: contained([
          {
            Component: RequireAuth,
            children: [
              {
                Component: ApplicationLayout,
                children: [
                  { index: true, element: <h1>Fine</h1> },
                  { path: 'broken', Component: Boom },
                ],
              },
            ],
          },
          ...routes[0]!.children!.filter((r) => !r.children?.some((c) => c.Component === ApplicationLayout)),
        ]),
      },
    ];
    const router = renderApp('/login?returnTo=%2Fbroken', tree);
    await signIn('manager');
    expect(await screen.findByRole('alert')).toHaveTextContent('This part of the page could not be shown.');
    // The layout around the failed route still works: the sidebar navigates away from the error.
    await userEvent.click(within(sidebar()).getByRole('link', { name: 'Dashboard' }));
    await screen.findByRole('heading', { level: 1, name: 'Fine' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('an unknown address shows not found inside the app', async () => {
    renderApp('/login?returnTo=%2Fno-such-page');
    await signIn('manager');
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(sidebar()).toBeInTheDocument();
  });
});

describe('shell, top bar and language', () => {
  it('has the landmarks, the user menu and no accessibility violations', async () => {
    renderApp('/login');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Estate: All estates/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No approvals waiting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('switches the whole app to Bangla, including the component library', async () => {
    renderApp('/login');
    await signIn('manager');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    await userEvent.click(screen.getByRole('button', { name: 'Switch language to বাংলা' }));
    await screen.findByRole('heading', { level: 1, name: 'ড্যাশবোর্ড' });
    expect(document.documentElement.lang).toBe('bn');
    expect(screen.getByRole('navigation', { name: 'প্রধান' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'মূল বিষয়বস্তুতে যান' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ভাষা বদলে English করুন' })).toBeInTheDocument();
    });
  });
});
