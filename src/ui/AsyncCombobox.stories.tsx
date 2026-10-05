import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AsyncCombobox, type ComboboxOption, type LoadOptionsArgs } from './AsyncCombobox';

/** A fake server: 20,000 workers, searched by name or code, 25 per page, with 300 ms latency. */
const WORKERS: ComboboxOption[] = Array.from({ length: 20_000 }, (_, i) => {
  const first = ['Rahim', 'Karim', 'Sumi', 'Rupa', 'Joba', 'Mithun', 'Lata', 'Bikash'][i % 8] ?? 'Worker';
  const last = ['Uddin', 'Munda', 'Orang', 'Tanti', 'Kurmi', 'Bhumij'][i % 6] ?? '';
  return {
    id: String(i + 1),
    label: `${first} ${last}`,
    description: `EMP-${String(i + 1).padStart(5, '0')} · Division ${(i % 4) + 1}`,
  };
});

function fakeSearch({ query, cursor, signal }: LoadOptionsArgs) {
  return new Promise<{ items: ComboboxOption[]; nextCursor: string | null }>((resolve, reject) => {
    const timer = setTimeout(() => {
      const q = query.trim().toLowerCase();
      const matches = q
        ? WORKERS.filter(
            (w) => w.label.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q),
          )
        : WORKERS;
      const start = cursor ? Number.parseInt(cursor, 10) : 0;
      const items = matches.slice(start, start + 25);
      resolve({ items, nextCursor: start + 25 < matches.length ? String(start + 25) : null });
    }, 300);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

const meta = {
  title: 'Forms/AsyncCombobox',
  component: AsyncCombobox,
  args: { label: 'Worker', loadOptions: fakeSearch },
  parameters: {
    docs: {
      description: {
        component: [
          'Search and pick one record from a large set. This demo searches 20,000 fake workers.',
          '',
          '**Usage rules**',
          '- `loadOptions({ query, cursor, signal })` calls the server; pass `signal` on so stale searches are',
          '  cancelled. Return `nextCursor` to load more as the user scrolls.',
          '- Searches 300 ms after the last keystroke (`debounceMs`).',
          '- The value is `{ id, label }`, so an existing selection shows without loading the list.',
          '- `emptyMessage` should suggest what to try next.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof AsyncCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchWorkers: Story = {
  render: function Render(args) {
    const [worker, setWorker] = useState<ComboboxOption | null>(null);
    return (
      <div className="max-w-md space-y-3">
        <AsyncCombobox
          {...args}
          value={worker}
          onChange={setWorker}
          isRequired
          hint="Search by name or EMP code."
        />
        <p className="text-sm text-fg-muted">
          Selected: <code className="font-mono text-fg">{JSON.stringify(worker)}</code>
        </p>
      </div>
    );
  },
};

export const WithExistingValue: Story = {
  args: { value: { id: '42', label: 'Joba Tanti', description: 'EMP-00042 · Division 2' } },
};

export const Invalid: Story = { args: { error: 'Choose the worker who plucked this leaf.' } };

export const Disabled: Story = { args: { isDisabled: true } };
