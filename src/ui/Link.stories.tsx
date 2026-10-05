import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Link } from './Link';

const meta = {
  title: 'Primitives/Link',
  component: Link,
  args: { href: '/workers', children: 'View all workers' },
  argTypes: { variant: { control: 'inline-radio', options: ['inline', 'standalone'] } },
  parameters: {
    docs: {
      description: {
        component: [
          'Navigation to another page.',
          '',
          '**Usage rules**',
          '- A Link goes somewhere; a Button does something. Never use a Link to save, delete or approve.',
          '- `inline` inside running text is always underlined, so it is not identified by colour alone.',
          '- `standalone` on its own line ("View all workers") is underlined on hover and 44 px tall below md.',
          '- The text says where it goes; never "click here".',
          '- `isExternal` opens a new tab and says so to screen readers.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  render: (args) => (
    <p className="max-w-prose text-fg">
      The muster for Division 3 has two absentees. <Link {...args}>Review the muster</Link> before closing the
      day.
    </p>
  ),
};

export const Standalone: Story = { args: { variant: 'standalone' } };

export const External: Story = {
  args: { href: 'https://www.teaboard.gov.bd', children: 'Bangladesh Tea Board', isExternal: true },
};

export const Hover: Story = {
  args: { variant: 'standalone' },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('link'));
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('link')).toHaveFocus();
  },
};

export const Disabled: Story = { args: { isDisabled: true } };
