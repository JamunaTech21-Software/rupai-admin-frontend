import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { AppShell } from './AppShell';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { Grid, Inline, Stack, Toolbar } from './Layout';
import { PageHeader } from './PageHeader';
import { type NavSection } from './Sidebar';
import { StatCard } from './StatCard';
import { Stepper } from './Stepper';
import { ContextSwitcher, UserMenu } from './TopBar';

const meta = {
  title: 'Layout/App shell, page header & layout',
  parameters: {
    docs: {
      description: {
        component: [
          '**AppShell** is the application frame, after the RupAi dashboard design: skip link, sidebar',
          '(permanent from lg and collapsible to an icon rail, remembered; a drawer below lg), top bar and main',
          'region. F0.07 puts it around the application routes and fills in the real navigation and user.',
          '',
          '**PageHeader** tops every page: breadcrumbs, the one h1, the record’s status badge and its actions.',
          '**Toolbar** groups related buttons into one Tab stop (arrow keys inside). **Stack**, **Inline** and',
          '**Grid** do the spacing. **Stepper** shows progress through a multi-step task.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NAVIGATION: NavSection[] = [
  {
    id: 'main',
    items: [{ id: 'dashboard', label: 'Dashboard', href: '/', icon: 'home' }],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      {
        id: 'estate',
        label: 'Estate',
        icon: 'map',
        children: [
          { id: 'divisions', label: 'Divisions & sections', href: '/estate/divisions' },
          { id: 'fields', label: 'Fields', href: '/estate/fields' },
        ],
      },
      {
        id: 'workforce',
        label: 'Workforce',
        icon: 'users',
        children: [
          { id: 'workers', label: 'Workers', href: '/workers' },
          { id: 'gangs', label: 'Gangs', href: '/gangs' },
          { id: 'muster', label: 'Daily muster', href: '/muster', badge: 3 },
        ],
      },
      { id: 'plucking', label: 'Plucking', href: '/plucking', icon: 'leaf' },
      { id: 'factory', label: 'Factory', href: '/factory', icon: 'factory' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { id: 'payroll', label: 'Payroll', href: '/payroll', icon: 'wallet', badge: 14 },
      { id: 'reports', label: 'Reports', href: '/reports', icon: 'chart' },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    items: [
      { id: 'users', label: 'Users & roles', href: '/admin/users', icon: 'shield' },
      { id: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

export const ApplicationFrame: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <AppShell
      brand={{ name: 'RupAi ERP', tagline: 'Smart Management for Tea Estates', logoSrc: '/logo.png' }}
      navigation={NAVIGATION}
      currentPath="/workers"
      title="Workforce"
      topBarActions={
        <>
          <ContextSwitcher
            label="Estate"
            icon="mapPin"
            options={[
              { id: 'all', label: 'All my estates' },
              { id: '3', label: 'Rupai Estate' },
              { id: '7', label: 'Hill View Estate' },
            ]}
            value="3"
            onChange={() => undefined}
          />
          <IconButton icon="bell" label="Notifications" variant="ghost" />
          <UserMenu
            name="Abdul Karim"
            detail="Manager · Rupai Estate"
            items={[
              { id: 'profile', label: 'My profile', icon: 'user' },
              { id: 'settings', label: 'Account settings', icon: 'settings' },
              { id: 'logout', label: 'Sign out', icon: 'logout', isDanger: true },
            ]}
            onAction={() => undefined}
          />
        </>
      }
    >
      <Stack gap={6}>
        <PageHeader
          title="Workers"
          description="1,240 workers in Rupai Estate"
          breadcrumbs={[{ label: 'Workforce', href: '/workforce' }, { label: 'Workers' }]}
          actions={
            <>
              <Button variant="secondary" iconStart="download">
                Export
              </Button>
              <Button iconStart="plus">Add worker</Button>
            </>
          }
        />
        <Grid columns={3}>
          <StatCard label="Active workers" value="1,198" />
          <StatCard label="On leave today" value="23" />
          <StatCard label="Joined this month" value="12" />
        </Grid>
      </Stack>
    </AppShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Main' });
    await expect(within(nav).getByRole('link', { name: 'Workers' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('main')).toBeInTheDocument();
    await expect(canvas.getByRole('banner')).toBeInTheDocument();
  },
};

export const PageHeaders: Story = {
  render: () => (
    <Stack gap={8} className="max-w-4xl">
      <PageHeader
        title="Muster 4 Oct 2026, Section 4"
        status={{ tone: 'submitted', label: 'Submitted' }}
        description="212 workers · submitted by Shefali Das"
        breadcrumbs={[
          { label: 'Workforce', href: '/workforce' },
          { label: 'Daily muster', href: '/muster' },
          { label: '4 Oct 2026' },
        ]}
        actions={
          <>
            <Button variant="secondary">Reject</Button>
            <Button>Approve</Button>
          </>
        }
      />
      <PageHeader title="Settings" />
    </Stack>
  ),
};

export const ToolbarAndSpacing: Story = {
  render: () => (
    <Stack gap={6} className="max-w-4xl">
      <Toolbar label="Muster actions">
        <Button variant="secondary" size="sm" iconStart="edit">
          Edit
        </Button>
        <Button variant="secondary" size="sm" iconStart="download">
          Export
        </Button>
        <Button variant="secondary" size="sm" iconStart="refresh">
          Recalculate
        </Button>
      </Toolbar>
      <Inline justify="between">
        <span className="text-fg-muted">Inline: side by side, wrapping</span>
        <Inline>
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
          <Button size="sm">Save</Button>
        </Inline>
      </Inline>
      <Grid minItemWidth="12rem">
        {['Division 1', 'Division 2', 'Division 3', 'Division 4'].map((name) => (
          <Card key={name} title={name} headingLevel={3}>
            <p className="text-sm text-fg-muted">Grid fills the row with 12rem cards.</p>
          </Card>
        ))}
      </Grid>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Export' })).toHaveFocus();
  },
};

export const Steps: Story = {
  render: () => (
    <Stack gap={8} className="max-w-3xl">
      <Stepper
        label="Import steps"
        currentStep={1}
        steps={[
          { id: 'upload', label: 'Upload', description: 'The spreadsheet' },
          { id: 'check', label: 'Check', description: 'Fix rows with problems' },
          { id: 'confirm', label: 'Confirm', description: 'Import 1,240 workers' },
        ]}
      />
      <Stepper
        label="Payroll run"
        orientation="vertical"
        currentStep={2}
        steps={[
          { id: 'attendance', label: 'Lock attendance' },
          { id: 'calculate', label: 'Calculate wages' },
          { id: 'review', label: 'Review and approve' },
          { id: 'post', label: 'Post to ledger' },
        ]}
      />
    </Stack>
  ),
};
