import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './Badge';
import { DOCUMENT_STATES, FEEDBACK_ROLES } from './tokens';

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { tone: 'approved', label: 'Approved' },
  argTypes: {
    tone: { control: 'select', options: [...DOCUMENT_STATES, ...FEEDBACK_ROLES, 'neutral'] },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A read-only status: a document state or a feedback status.',
          '',
          '**Usage rules**',
          '- `label` is required: colour never carries meaning on its own. Each state also has its own icon shape.',
          '- Use the document-state tones (draft … cancelled) for records with a workflow, exactly as the state is named.',
          '- Feedback tones (success, warning, danger, info) for results and conditions, not for workflow states.',
          '- Not interactive. For a removable or selectable chip use Tag.',
          '- `hideIcon` only in dense tables; the label still carries the meaning.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DocumentStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {DOCUMENT_STATES.map((state) => (
        <Badge key={state} tone={state} label={label(state)} />
      ))}
    </div>
  ),
};

export const Feedback: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {FEEDBACK_ROLES.map((role) => (
        <Badge key={role} tone={role} label={label(role)} />
      ))}
      <Badge tone="neutral" label="Neutral" />
    </div>
  ),
};

export const WithoutIcon: Story = { args: { hideIcon: true } };
