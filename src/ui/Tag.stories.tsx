import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Tag } from './Tag';

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  args: { label: 'Division 3' },
  parameters: {
    docs: {
      description: {
        component: [
          'A neutral chip for a category, an applied filter or a selected value.',
          '',
          '**Usage rules**',
          '- Never a status: statuses are Badges.',
          '- With `onRemove`, the remove button is named "Remove {label}" and works with Tab and Enter or Space.',
          '- After removing, move focus to the next tag or back to the field that adds tags.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Removable: Story = {
  args: { onRemove: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.tab();
    const remove = within(canvasElement).getByRole('button', { name: 'Remove Division 3' });
    await expect(remove).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};

export const Group: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag label="Division 1" onRemove={fn()} />
      <Tag label="Division 3" onRemove={fn()} />
      <Tag label="Pluckers" />
      <Tag label="বাগান ২" onRemove={fn()} />
    </div>
  ),
};

export const Disabled: Story = { args: { onRemove: fn(), isDisabled: true } };
