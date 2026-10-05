import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { useUrlPage, useUrlTab } from '@/lib/urlState';

import { Accordion } from './Accordion';
import { Button } from './Button';
import { Card } from './Card';
import { DescriptionList } from './DescriptionList';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { StatCard } from './StatCard';
import { Tabs } from './Tabs';
import { Timeline } from './Timeline';
import { Tree } from './Tree';

const meta = {
  title: 'Data display/Cards, lists, tabs & more',
  parameters: {
    docs: {
      description: {
        component: [
          '**Card** groups related content; with a `title` it is a labelled region. **DescriptionList** shows a',
          'record\'s labelled values (empty values read as "Not set"). **StatCard** is a headline figure with a',
          'comparison and a drill-down link to the detail behind it.',
          '',
          '**Timeline** is a document’s status and approval history, times in Asia/Dhaka. **Tabs** and',
          '**Pagination** are controlled: keep their state in the URL with `useUrlTab` / `useUrlPage` from',
          '`lib/urlState`, so views can be linked and survive reload.',
          '',
          '**EmptyState** has three kinds: `new` (nothing yet), `no-results` (filters match nothing) and `done`',
          '(a queue is cleared). **Accordion** and **Tree** are keyboard-operable disclosure and hierarchy.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardWithDetails: Story = {
  render: () => (
    <Card
      title="Worker details"
      description="EMP-00042"
      actions={
        <Button size="sm" variant="secondary" iconStart="edit">
          Edit
        </Button>
      }
      className="max-w-2xl"
    >
      <DescriptionList
        columns={2}
        items={[
          { term: 'Name', description: 'Rahim Uddin' },
          { term: 'Gang', description: 'G-04 Section 4 pluckers' },
          { term: 'Joined', description: '12 Jan 2019' },
          { term: 'Daily rate', description: '৳178.00', isNumeric: true },
          { term: 'NID', description: null },
        ]}
      />
    </Card>
  ),
};

export const StatCards: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
      <StatCard
        label="Leaf plucked today"
        value="12,480.500"
        unit="kg"
        comparison={{ direction: 'up', sentiment: 'positive', text: '8% more than yesterday' }}
        drillDown={{ href: '/reports/plucking?date=2026-10-04', label: 'View plucking by section' }}
      />
      <StatCard
        label="Musters waiting for approval"
        value="14"
        comparison={{ direction: 'up', sentiment: 'negative', text: '5 more than this time last week' }}
        drillDown={{ href: '/musters?status=submitted', label: 'Review the 14 musters' }}
      />
      <StatCard
        label="Wages this period"
        value="৳30,40,062.50"
        comparison={{ direction: 'flat', sentiment: 'neutral', text: 'Same as last period' }}
      />
    </div>
  ),
};

export const ApprovalTimeline: Story = {
  render: () => (
    <Timeline
      label="Approval history"
      className="max-w-xl"
      events={[
        { id: '1', title: 'Created', state: 'draft', actor: 'Shefali Das', at: '2026-10-04T02:10:00Z' },
        {
          id: '2',
          title: 'Submitted for approval',
          state: 'submitted',
          actor: 'Shefali Das',
          at: '2026-10-04T08:05:00Z',
        },
        {
          id: '3',
          title: 'Rejected',
          state: 'rejected',
          actor: 'Abdul Karim (Manager)',
          at: '2026-10-04T10:30:00Z',
          note: 'Line 2 is above the 60 kg daily limit. Check the weighing slip.',
        },
        {
          id: '4',
          title: 'Approved',
          state: 'approved',
          actor: 'Abdul Karim (Manager)',
          at: '2026-10-04T12:45:00Z',
        },
      ]}
    />
  ),
};

function UrlTabs() {
  return (
    <Tabs
      label="Worker sections"
      {...useUrlTab('tab', 'profile')}
      items={[
        { id: 'profile', label: 'Profile', content: <p>Name, gang and contact details.</p> },
        { id: 'attendance', label: 'Attendance', count: 22, content: <p>22 days this month.</p> },
        { id: 'payslips', label: 'Payslips', content: <p>Payslips for the last 12 periods.</p> },
        { id: 'loans', label: 'Loans', isDisabled: true, content: null },
      ]}
    />
  );
}

export const TabsInUrl: Story = {
  render: () => <UrlTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /Attendance/ }));
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('22 days this month.');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Payslips' })).toHaveAttribute('aria-selected', 'true');
  },
};

export const AccordionSections: Story = {
  render: () => (
    <Accordion
      className="max-w-xl"
      defaultExpandedKeys={['earnings']}
      items={[
        {
          id: 'earnings',
          title: 'Earnings',
          summary: '৳5,340.00',
          content: <p>Plucking: ৳4,890.00 · Overtime: ৳450.00</p>,
        },
        {
          id: 'deductions',
          title: 'Deductions',
          summary: '3 items',
          content: <p>Provident fund, ration, advance.</p>,
        },
      ]}
    />
  ),
};

export const EstateTree: Story = {
  render: () => (
    <Tree
      label="Estate hierarchy"
      className="max-w-md"
      defaultExpandedKeys={['rupai']}
      items={[
        {
          id: 'rupai',
          label: 'Rupai Estate',
          description: '3 divisions',
          children: [
            {
              id: 'd1',
              label: 'Division 1',
              children: [
                { id: 'd1-s1', label: 'Section 1', description: '42 ha' },
                { id: 'd1-s2', label: 'Section 2', description: '38 ha' },
              ],
            },
            { id: 'd2', label: 'Division 2', children: [{ id: 'd2-s1', label: 'Section 1' }] },
            { id: 'd3', label: 'Division 3' },
          ],
        },
      ]}
    />
  ),
};

export const EmptyStates: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-4 md:grid-cols-3">
      <Card>
        <EmptyState
          kind="new"
          title="No gangs yet"
          description="Gangs group workers for the daily muster. Add the first one to start."
          action={<Button iconStart="plus">Add gang</Button>}
        />
      </Card>
      <Card>
        <EmptyState
          kind="no-results"
          title="No workers match"
          description="Nothing matches “Rahm” in Division 2."
          action={<Button variant="secondary">Clear filters</Button>}
        />
      </Card>
      <Card>
        <EmptyState
          kind="done"
          title="All caught up"
          description="No musters are waiting for your approval."
        />
      </Card>
    </div>
  ),
};

function UrlPagination() {
  return <Pagination {...useUrlPage({ pageSize: 25 })} totalItems={1240} itemLabel="workers" />;
}

export const PaginationInUrl: Story = {
  render: () => <UrlPagination />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1–25 of 1,240 workers')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expect(canvas.getByText('26–50 of 1,240 workers')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  },
};
