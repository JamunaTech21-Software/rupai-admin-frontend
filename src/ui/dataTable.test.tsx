import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatSort, parseSort } from '@/lib/urlState';

import { axeViolations } from '../../tests/axe';

import { columnStorageKey } from './columnPreferences';
import { DataTable } from './DataTable';
import { WORKER_COLUMNS } from './fixtures/workerColumns';
import { WorkersTable } from './fixtures/WorkersTable';
import { DEMO_WORKERS, queryDemoWorkers } from './fixtures/workers';

function Location() {
  const location = useLocation();
  return <output aria-label="URL">{decodeURIComponent(location.search)}</output>;
}
const search = () => screen.getByRole('status', { name: 'URL' }).textContent;

function renderWorkers(path = '/workers', onExport?: (ids: string[]) => void) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkersTable {...(onExport ? { onExport } : {})} />
      <Location />
    </MemoryRouter>,
  );
}

/** The first-column (row header) values, in order. */
const rowNames = () => screen.getAllByRole('rowheader').map((cell) => cell.textContent);

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sort, filter and page live in the URL query string', () => {
  it('renders what the URL asks for', () => {
    renderWorkers('/workers?sort=-leaf_kg&filter[status]=disabled&per_page=10');
    const expected = queryDemoWorkers('sort=-leaf_kg&filter[status]=disabled&page=1&per_page=10');
    expect(rowNames()).toEqual(expected.data.map((w) => w.name));
    expect(screen.getByRole('columnheader', { name: /Leaf/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText(`1–10 of ${String(expected.total)} workers`)).toBeInTheDocument();
  });

  it('a header click sorts ascending, then descending, then back to the default, each time from page 1', async () => {
    renderWorkers('/workers?page=3');
    const leaf = () => screen.getByRole('columnheader', { name: /Leaf/ });
    expect(leaf()).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(within(leaf()).getByRole('button'));
    expect(search()).toBe('?sort=leaf_kg');
    expect(leaf()).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(within(leaf()).getByRole('button'));
    expect(search()).toBe('?sort=-leaf_kg');

    await userEvent.click(within(leaf()).getByRole('button'));
    expect(search()).toBe('');
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('filters go into the URL in the API grammar and return to page 1', async () => {
    renderWorkers('/workers?page=2');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'rin');
    expect(search()).toBe('?filter[name][like]=rin');
    expect(rowNames().every((name) => name.toLowerCase().startsWith('rin'))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Status/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Disabled' }));
    expect(search()).toBe('?filter[name][like]=rin&filter[status]=disabled');
  });

  it('paging writes page and per_page', async () => {
    renderWorkers();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(search()).toBe('?page=2');
    expect(screen.getByText('11–20 of 120 workers')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Rows per page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '25' }));
    expect(search()).toBe('?per_page=25');
  });

  it('shows the "no results" state with a way out when filters match nothing', async () => {
    renderWorkers('/workers?filter[name][like]=zzz');
    expect(screen.getByRole('heading', { name: 'No workers match' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search()).toBe('');
    expect(rowNames()).toHaveLength(10);
  });
});

describe('sort parameter', () => {
  it('parses and formats the API form', () => {
    expect(parseSort('name,-created_at')).toEqual([
      { id: 'name', desc: false },
      { id: 'created_at', desc: true },
    ]);
    expect(parseSort('bad field,-ok;drop,')).toEqual([]);
    expect(formatSort([{ id: 'leaf_kg', desc: true }])).toBe('-leaf_kg');
  });
});

describe('table structure', () => {
  it('has a caption, a row header per row, right-aligned numbers and no accessibility violations', async () => {
    const { container } = renderWorkers();
    expect(screen.getByRole('table', { name: 'Workers' })).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(10);
    const leafCell = screen.getAllByRole('row')[1]?.querySelectorAll('td')[4];
    expect(leafCell?.className).toMatch(/text-end/);
    expect(leafCell?.className).toMatch(/figures/);
    // The scrolling area can be reached with the keyboard.
    expect(screen.getByRole('region', { name: 'Workers' })).toHaveAttribute('tabindex', '0');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('column visibility', () => {
  it('hides and shows columns from the Columns menu, and remembers the choice', async () => {
    const { unmount } = renderWorkers();
    expect(screen.queryByRole('columnheader', { name: /Joined/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const menu = await screen.findByRole('menu', { name: 'Columns' });
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Name' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // The menu stays open for several choices; the table behind is hidden from assistive tech until it closes.
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Joined' }));
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Division' }));
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Joined' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('columnheader', { name: /Joined/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Division' })).not.toBeInTheDocument();

    expect(JSON.parse(window.localStorage.getItem(columnStorageKey('demo-workers')) ?? 'null')).toEqual([
      'division',
    ]);
    unmount();
    renderWorkers();
    expect(screen.queryByRole('columnheader', { name: 'Division' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Joined/ })).toBeInTheDocument();
  });
});

describe('row selection', () => {
  it('is offered only when there is a bulk action', () => {
    render(
      <DataTable
        label="Workers"
        columns={WORKER_COLUMNS}
        rows={DEMO_WORKERS.slice(0, 3)}
        getRowId={(w) => w.id}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('selects rows, shows the bulk bar, and passes the ids to the action', async () => {
    const onExport = vi.fn();
    renderWorkers('/workers', onExport);
    const first = queryDemoWorkers('sort=name&page=1&per_page=10').data[0];
    if (!first) throw new Error('no data');

    await userEvent.click(screen.getByRole('checkbox', { name: `Select ${first.name} (${first.code})` }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('1 selected');
    const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
    expect(all).toBePartiallyChecked();

    await userEvent.click(all);
    expect(bar).toHaveTextContent('10 selected');
    await userEvent.click(within(bar).getByRole('button', { name: 'Export 10' }));
    expect(onExport).toHaveBeenCalledWith(expect.arrayContaining([first.id]));
    expect(onExport.mock.calls[0]?.[0]).toHaveLength(10);
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('drops the selection when the page changes', async () => {
    renderWorkers();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    });
  });
});

describe('below md: cards', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
  });

  it('shows each row as a card with labelled values, and a "Sort by" choice', async () => {
    renderWorkers();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'Workers' })).getAllByRole('listitem');
    expect(cards).toHaveLength(10);
    expect(within(cards[0]!).getByText('Leaf (kg)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sort by/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Leaf (kg) (descending)' }));
    expect(search()).toBe('?sort=-leaf_kg');
  });
});

describe('states', () => {
  it('loading shows a busy table with skeleton rows', () => {
    render(<DataTable label="Workers" columns={WORKER_COLUMNS} rows={[]} getRowId={(w) => w.id} isLoading />);
    expect(screen.getByRole('table', { name: 'Workers' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('rowheader')).not.toBeInTheDocument();
  });

  it('refetching keeps the rows and says it is updating', () => {
    render(
      <DataTable
        label="Workers"
        columns={WORKER_COLUMNS}
        rows={DEMO_WORKERS.slice(0, 2)}
        getRowId={(w) => w.id}
        isLoading
      />,
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.getByText('Updating')).toBeInTheDocument();
  });

  it('an error replaces the rows, with the request id and a retry', async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        label="Workers"
        columns={WORKER_COLUMNS}
        rows={[]}
        getRowId={(w) => w.id}
        error={{ requestId: 'req_9', onRetry }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Workers could not be loaded');
    expect(screen.getByText('req_9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('load more (cursor lists) asks for the next page and says when everything is shown', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <DataTable
        label="Records"
        columns={WORKER_COLUMNS}
        rows={DEMO_WORKERS.slice(0, 20)}
        getRowId={(w) => w.id}
        loadMore={{ hasMore: true, isLoadingMore: false, onLoadMore }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalled();
    rerender(
      <DataTable
        label="Records"
        columns={WORKER_COLUMNS}
        rows={DEMO_WORKERS.slice(0, 25)}
        getRowId={(w) => w.id}
        loadMore={{ hasMore: false, isLoadingMore: false, onLoadMore }}
      />,
    );
    expect(screen.getByText('Showing 25 (all)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
