import type { Meta, StoryObj } from '@storybook/react-vite';

import { Divider } from './Divider';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';

const meta = {
  title: 'Primitives/Spinner, Skeleton & Divider',
  parameters: {
    docs: {
      description: {
        component: [
          '**Spinner**: an indeterminate wait. It announces "Loading" (or its `label`) as a status; pass `label={null}` when something else already announces it. It stops spinning under reduced motion but stays visible.',
          '',
          '**Skeleton**: the loading state of a region whose shape is known (text, block, table rows). Hidden from assistive technology: put `aria-busy="true"` on the loading region. Prefer it to a Spinner for page content, so the layout does not jump.',
          '',
          '**Divider**: a line between groups. Announced as a separator unless `decorative`.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-primary">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" label="Loading the muster" />
    </div>
  ),
};

export const SkeletonText: Story = {
  render: () => (
    <div aria-busy="true" className="max-w-md">
      <Skeleton variant="text" lines={4} />
    </div>
  ),
};

export const SkeletonBlock: Story = {
  render: () => (
    <div aria-busy="true" className="max-w-md">
      <Skeleton variant="block" className="h-40 w-full" />
    </div>
  ),
};

export const SkeletonTableRows: Story = {
  render: () => (
    <div aria-busy="true" className="max-w-2xl rounded-lg border border-line bg-surface">
      <Skeleton variant="table-row" columns={4} rows={5} />
    </div>
  ),
};

export const Dividers: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <p className="text-fg">Division 1</p>
      <Divider />
      <p className="text-fg">Division 2</p>
      <div className="flex h-8 items-center gap-3 text-fg">
        <span>Edit</span>
        <Divider orientation="vertical" decorative />
        <span>Export</span>
      </div>
    </div>
  ),
};
