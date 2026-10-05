import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { IconButton } from './IconButton';

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: { icon: 'close', label: 'Close', onPress: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A button whose only visible content is an icon.',
          '',
          '**Usage rules**',
          '- `label` is required and is the accessible name: say what happens ("Delete worker"), not what it looks like ("Bin").',
          '- Use only for widely understood icons (close, more, edit, search). Anything else gets a Button with a label.',
          '- Defaults to `ghost`. A Tooltip (F0.05) shows the label on hover and focus.',
          '- Below md the target is at least 44 × 44 px.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <IconButton {...args} variant="ghost" icon="edit" label="Edit worker" />
      <IconButton {...args} variant="secondary" icon="more" label="More actions" />
      <IconButton {...args} variant="primary" icon="plus" label="Add worker" />
      <IconButton {...args} variant="danger" icon="trash" label="Delete worker" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconButton {...args} size="sm" />
      <IconButton {...args} size="md" />
      <IconButton {...args} size="lg" />
    </div>
  ),
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: 'Close' }));
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button', { name: 'Close' })).toHaveFocus();
  },
};

export const Disabled: Story = { args: { isDisabled: true } };

export const Loading: Story = { args: { icon: 'refresh', label: 'Refresh', isPending: true } };
