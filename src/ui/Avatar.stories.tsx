import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from './Avatar';

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar,
  args: { name: 'Rahim Uddin' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  parameters: {
    docs: {
      description: {
        component: [
          "A person's photo, falling back to their initials.",
          '',
          '**Usage rules**',
          '- Set `decorative` when the name is written next to the avatar, so it is not read twice.',
          '- Initials are split by grapheme, so Bengali names keep whole letters.',
          '- A missing or broken photo falls back to the initials; never show a broken image.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const Bengali: Story = { args: { name: 'রহিম উদ্দিন' } };

export const WithPhoto: Story = { args: { name: 'RupAI', src: '/logo.png' } };

/** Error state: the photo fails to load, so the initials show. */
export const BrokenPhoto: Story = { args: { src: '/does-not-exist.png' } };

/** Empty state: no name yet. */
export const NoName: Story = { args: { name: '' } };

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
    </div>
  ),
};

export const BesideName: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} decorative />
      <span className="font-medium text-fg">{args.name}</span>
    </div>
  ),
};
