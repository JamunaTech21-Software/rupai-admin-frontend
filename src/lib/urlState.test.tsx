import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Pagination, Tabs } from '@/ui';

import { useUrlPage, useUrlParam, useUrlTab } from './urlState';

function Location() {
  const location = useLocation();
  return <output aria-label="URL">{location.pathname + location.search}</output>;
}

const url = () => screen.getByRole('status', { name: 'URL' }).textContent;

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <Location />
    </MemoryRouter>,
  );
}

function WorkerTabs() {
  return (
    <Tabs
      label="Worker sections"
      {...useUrlTab('tab', 'profile')}
      items={[
        { id: 'profile', label: 'Profile', content: 'Profile panel' },
        { id: 'payslips', label: 'Payslips', content: 'Payslips panel' },
      ]}
    />
  );
}

describe('useUrlTab', () => {
  it('opens the tab named in the URL', () => {
    renderAt('/workers/42?tab=payslips', <WorkerTabs />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Payslips panel');
  });

  it('writes the chosen tab to the URL, and drops it for the default tab', async () => {
    renderAt('/workers/42?q=x', <WorkerTabs />);
    await userEvent.click(screen.getByRole('tab', { name: 'Payslips' }));
    expect(url()).toBe('/workers/42?q=x&tab=payslips');
    await userEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(url()).toBe('/workers/42?q=x');
  });

  it('falls back to the first tab for an unknown key from an old link', () => {
    renderAt('/workers/42?tab=gone', <WorkerTabs />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Profile panel');
  });
});

function Pages() {
  return <Pagination {...useUrlPage({ pageSize: 25 })} totalItems={1240} itemLabel="workers" />;
}

describe('useUrlPage', () => {
  it('reads page and size from the URL', () => {
    renderAt('/workers?page=3&per_page=50', <Pages />);
    expect(screen.getByText('101–150 of 1,240 workers')).toBeInTheDocument();
  });

  it('ignores malformed values', () => {
    renderAt('/workers?page=abc&per_page=-5', <Pages />);
    expect(screen.getByText('1–25 of 1,240 workers')).toBeInTheDocument();
  });

  it('writes the page to the URL and resets to page 1 when the size changes', async () => {
    renderAt('/workers?status=active', <Pages />);
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(url()).toBe('/workers?status=active&page=2');

    await userEvent.click(screen.getByRole('button', { name: /Rows per page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '50' }));
    expect(url()).toBe('/workers?status=active&per_page=50');
  });
});

describe('useUrlParam', () => {
  function Filter() {
    const [status, setStatus] = useUrlParam('status', 'all');
    return (
      <button
        type="button"
        onClick={() => {
          setStatus(status === 'all' ? 'active' : null);
        }}
      >
        {status}
      </button>
    );
  }

  it('sets and clears one parameter, keeping the others', async () => {
    renderAt('/workers?page=2', <Filter />);
    await userEvent.click(screen.getByRole('button', { name: 'all' }));
    expect(url()).toBe('/workers?page=2&status=active');
    await userEvent.click(screen.getByRole('button', { name: 'active' }));
    expect(url()).toBe('/workers?page=2');
  });
});
