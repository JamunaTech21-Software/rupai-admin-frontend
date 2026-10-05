import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../tests/axe';

import { AppShell } from './AppShell';
import { Button } from './Button';
import { Toolbar } from './Layout';
import { PageHeader } from './PageHeader';
import { type NavSection, Sidebar } from './Sidebar';
import { Stepper } from './Stepper';
import { UserMenu } from './TopBar';

const NAV: NavSection[] = [
  { id: 'main', items: [{ id: 'home', label: 'Dashboard', href: '/', icon: 'home' }] },
  {
    id: 'ops',
    title: 'Operations',
    items: [
      {
        id: 'workforce',
        label: 'Workforce',
        icon: 'users',
        children: [
          { id: 'workers', label: 'Workers', href: '/workers' },
          { id: 'gangs', label: 'Gangs', href: '/gangs' },
        ],
      },
      { id: 'payroll', label: 'Payroll', href: '/payroll', icon: 'wallet', badge: 14 },
    ],
  },
];

function stubWidth(isWide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: isWide,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageHeader and Breadcrumbs', () => {
  it('has one h1, the status in words, breadcrumbs with the current page, and actions', async () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader
          title="Muster 4 Oct"
          status={{ tone: 'approved', label: 'Approved' }}
          breadcrumbs={[{ label: 'Daily muster', href: '/muster' }, { label: '4 Oct' }]}
          actions={<Button>Export</Button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Muster 4 Oct' })).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumbs' });
    expect(within(crumbs).getByRole('link', { name: 'Daily muster' })).toHaveAttribute('href', '/muster');
    expect(within(crumbs).getByText('4 Oct').closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Toolbar', () => {
  it('is one Tab stop with arrow keys inside', async () => {
    render(
      <>
        <Toolbar label="Muster actions">
          <Button>Edit</Button>
          <Button>Export</Button>
        </Toolbar>
        <button type="button">After</button>
      </>,
    );
    expect(screen.getByRole('toolbar', { name: 'Muster actions' })).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });
});

describe('Stepper', () => {
  it('marks the current step and says each step’s state', () => {
    render(
      <Stepper
        label="Import steps"
        currentStep={1}
        steps={[
          { id: 'a', label: 'Upload' },
          { id: 'b', label: 'Check' },
          { id: 'c', label: 'Confirm' },
        ]}
      />,
    );
    const steps = within(screen.getByRole('list', { name: 'Import steps' })).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Step 1 of 3, complete');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).toHaveTextContent('Step 2 of 3, current');
    expect(steps[2]).not.toHaveAttribute('aria-current');
  });
});

describe('Sidebar', () => {
  it('marks the current page and opens its group', async () => {
    render(
      <MemoryRouter>
        <Sidebar sections={NAV} currentPath="/workers" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Workers' })).toHaveAttribute('aria-current', 'page');
    const group = within(nav).getByRole('button', { name: 'Workforce' });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(group);
    expect(within(nav).queryByRole('link', { name: 'Workers' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
  });

  it('keeps names for screen readers in the icon rail', () => {
    render(
      <MemoryRouter>
        <Sidebar sections={NAV} currentPath="/payroll" isCollapsed />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Payroll' })).toHaveAttribute('aria-current', 'page');
    // A group in the rail goes to its first page.
    expect(screen.getByRole('link', { name: 'Workforce' })).toHaveAttribute('href', '/workers');
  });
});

describe('UserMenu', () => {
  it('opens the account menu and reports the chosen action', async () => {
    const onAction = vi.fn();
    render(
      <UserMenu
        name="Abdul Karim"
        detail="Manager"
        items={[
          { id: 'profile', label: 'My profile' },
          { id: 'logout', label: 'Sign out', isDanger: true },
        ]}
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Account: Abdul Karim' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(onAction).toHaveBeenCalledWith('logout');
  });
});

function Shell() {
  return (
    <MemoryRouter>
      <AppShell brand={{ name: 'RupAi ERP' }} navigation={NAV} currentPath="/workers" title="Workforce">
        <h1>Workers</h1>
      </AppShell>
    </MemoryRouter>
  );
}

describe('AppShell', () => {
  it('has the landmarks, a skip link to main, and a collapsible sidebar that is remembered (wide)', async () => {
    stubWidth(true);
    const { container, unmount } = render(<Shell />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main');
    expect(await axeViolations(container)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    unmount();
    render(<Shell />);
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
  });

  it('below lg, opens the navigation as a drawer that traps focus and closes after navigating', async () => {
    stubWidth(false);
    render(<Shell />);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    const opener = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(opener);

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    await waitFor(() => {
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    });
    for (let i = 0; i < 8; i += 1) {
      await userEvent.tab();
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    }
    await userEvent.click(within(drawer).getByRole('link', { name: /^Payroll/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });
});
