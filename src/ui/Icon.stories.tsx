import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon } from './Icon';
import { icons, type IconName } from './iconSet';

const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: { name: 'leaf' },
  argTypes: {
    name: { control: 'select', options: Object.keys(icons) },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'The icon set: the only icons the app uses (Lucide, stroke 2).',
          '',
          '**Usage rules**',
          '- Import icons from `@/ui` by name, never from lucide-react, so the set stays small and consistent.',
          '- Decorative by default (hidden from screen readers) because text next to it names the meaning.',
          '- Give `label` only when the icon stands alone and means something; in a button use IconButton instead.',
          '- Icons inherit the text colour: colour them by role (`text-danger`), never by appearance.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Labelled: Story = { args: { name: 'alert', label: 'Warning', className: 'text-warning' } };

export const IconSet: Story = {
  render: () => (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {(Object.keys(icons) as IconName[]).map((name) => (
        <li key={name} className="flex flex-col items-center gap-1 rounded-md border border-line p-3 text-fg">
          <Icon name={name} />
          <span className="font-mono text-xs text-fg-muted">{name}</span>
        </li>
      ))}
    </ul>
  ),
};
