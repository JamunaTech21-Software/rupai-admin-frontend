import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Save draft', onPress: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'The button for every action.',
          '',
          '**Usage rules**',
          '- One `primary` button per view: the main action. Other actions are `secondary` or `ghost`.',
          '- `danger` only for destructive actions, and always behind a ConfirmDialog that names the consequence.',
          '- The label is a verb phrase ("Approve payroll", not "OK"). A button without visible words is an IconButton.',
          '- `isPending` while the action runs: the label stays, a spinner appears, presses are ignored and focus stays.',
          '- `isDisabled` only when the reason is visible nearby; otherwise let the action refuse with a message.',
          '- Keyboard: Tab to focus, Enter or Space to press. Below md every button is at least 44 px tall.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args} variant="primary">
        Approve payroll
      </Button>
      <Button {...args} variant="secondary">
        Save draft
      </Button>
      <Button {...args} variant="ghost">
        Cancel
      </Button>
      <Button {...args} variant="danger" iconStart="trash">
        Delete worker
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  args: { children: 'New worker', iconStart: 'plus' },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button')).toHaveFocus();
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

/** Loading: the label stays, so the button keeps its width and its name. */
export const Loading: Story = {
  args: { children: 'Approving…', isPending: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).not.toHaveBeenCalled();
    await expect(button).toHaveTextContent('Approving…');
  },
};

export const KeyboardPress: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(args.onPress).toHaveBeenCalledTimes(2);
    await expect(within(canvasElement).getByRole('button')).toHaveFocus();
  },
};
