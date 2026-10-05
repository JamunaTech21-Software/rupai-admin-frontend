import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from './Button';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';
import { WORKER_COLUMNS } from './fixtures/workerColumns';
import { WorkersTable } from './fixtures/WorkersTable';
import { DEMO_WORKERS } from './fixtures/workers';

const meta = {
  title: 'Data display/DataTable',
  parameters: {
    docs: {
      description: {
        component: [
          'The list table (Spec P5 §6.3), headless on TanStack Table. **Sorting, filtering and paging happen on',
          'the server**: the table shows `rows` and reports what the user asked for.',
          '',
          '- Keep sort, filters and page in the URL with `useUrlTableState` (lib/urlState). The query string uses',
          '  the API grammar (`sort=-name`, `filter[status]=active`, `page`, `per_page`), and `apiQuery` is the',
          '  request to send. Changing sort or a filter returns to page 1.',
          '- The header and the first column (the row header) stay visible while scrolling; numbers are',
          '  right-aligned in tabular figures.',
          '- **Columns** lets the user hide columns; the choice is remembered per table (`storageKey`).',
          '- Rows are selectable **only when `bulkActions` is given**.',
          '- Below md the rows become cards, with a "Sort by" choice.',
          '- `loadMore` replaces pages for the cursor-paginated tables.',
          '- States: `isLoading` (skeleton rows, or dimmed rows while refetching), `error` (with request id and',
          '  retry), `emptyState`.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServerSideWithUrlState: Story = {
  render: () => <WorkersTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(canvas.getByRole('button', { name: /Leaf \(kg\)/ }));
    await expect(canvas.getByRole('columnheader', { name: /Leaf/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expect(canvas.getByText(/11–20 of/)).toBeInTheDocument();
  },
};

export const Loading: Story = {
  render: () => (
    <DataTable label="Workers" columns={WORKER_COLUMNS} rows={[]} getRowId={(w) => w.id} isLoading />
  ),
};

export const LoadError: Story = {
  render: () => (
    <DataTable
      label="Workers"
      columns={WORKER_COLUMNS}
      rows={[]}
      getRowId={(w) => w.id}
      error={{ requestId: 'req_01J9Z7K4V8M2', onRetry: () => undefined }}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      label="Workers"
      columns={WORKER_COLUMNS}
      rows={[]}
      getRowId={(w) => w.id}
      emptyState={
        <EmptyState
          kind="new"
          title="No workers yet"
          description="Add workers one by one or import them from a spreadsheet."
          action={<Button iconStart="plus">Add worker</Button>}
        />
      }
    />
  ),
};

function CursorList() {
  const [count, setCount] = useState(20);
  return (
    <DataTable
      label="Weighing records"
      columns={WORKER_COLUMNS.slice(0, 5)}
      rows={DEMO_WORKERS.slice(0, count)}
      getRowId={(w) => w.id}
      loadMore={{
        hasMore: count < 60,
        isLoadingMore: false,
        onLoadMore: () => {
          setCount((c) => c + 20);
        },
      }}
    />
  );
}

export const LoadMore: Story = {
  render: () => <CursorList />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Load more' }));
    await expect(canvas.getByText('Showing 40')).toBeInTheDocument();
  },
};
