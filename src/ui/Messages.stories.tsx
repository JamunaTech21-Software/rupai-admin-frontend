import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Alert } from './Alert';
import { Button } from './Button';
import { ErrorState } from './ErrorState';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';
import { toast } from './toastQueue';
import { ToastRegion } from './Toast';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Feedback/Toast, Alert, ErrorState, ProgressBar & Tooltip',
  parameters: {
    docs: {
      description: {
        component: [
          '**Toast**: `toast.success(title)` / `toast.info(title)` confirm that something worked. Only success',
          'and info: an **error is never a toast**, because it disappears. Shown in the one `ToastRegion` that',
          'UiProvider renders (F6 reaches it); hovering or focusing pauses the timer.',
          '',
          '**Alert**: a message in the page that stays until dealt with. Danger alerts are announced when they',
          'appear. This is where server errors that name no field go.',
          '',
          '**ErrorState**: replaces a region whose data failed to load, with a retry and the `request_id`',
          'reference for support.',
          '',
          '**ProgressBar**: progress of a task with a known size; no value means indeterminate.',
          '',
          '**Tooltip**: extra help on hover or keyboard focus. Never the only place information lives.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Toasts: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button
        onPress={() => {
          toast.success('Muster saved', 'Section 4, 4 Oct 2026: 212 workers.');
        }}
      >
        Save muster
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          toast.info('Export started', 'It will be in Downloads in a minute.');
        }}
      >
        Export
      </Button>
      <ToastRegion />
    </div>
  ),
  play: async ({ canvasElement }) => {
    toast.dismiss();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save muster' }));
    const region = await within(document.body).findByRole('region', { name: /Notifications/ });
    await expect(within(region).getByText('Muster saved')).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('button', { name: 'Close notification' }));
    await waitFor(() => expect(within(document.body).queryByText('Muster saved')).not.toBeInTheDocument());
  },
};

export const Alerts: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <Alert tone="info" title="Rates changed on 1 October">
        Plucking rates for Division 2 rose to ৳8.2550 per kg.
      </Alert>
      <Alert tone="success" title="Period reconciled" announce={false}>
        September balances agree with the bank statement.
      </Alert>
      <Alert tone="warning" title="This period closes in 2 days" onDismiss={() => undefined}>
        Submit outstanding musters before 30 September.
      </Alert>
      <Alert
        tone="danger"
        title="The muster could not be submitted"
        action={
          <Button size="sm" variant="secondary">
            Reopen period
          </Button>
        }
      >
        The muster for this date has already been closed by the Manager.
      </Alert>
    </div>
  ),
};

export const ErrorStates: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-6">
      <div className="rounded-lg border border-line">
        <ErrorState
          title="The muster could not be loaded"
          requestId="req_01J9Z7K4V8M2"
          onRetry={() => undefined}
        />
      </div>
      <div className="rounded-lg border border-line">
        <ErrorState
          title="You cannot see this estate"
          message="Your account has no access to Rupai Estate. Ask an administrator to add it to your scope."
        />
      </div>
    </div>
  ),
};

export const ProgressBars: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <ProgressBar label="Importing workers" value={1240} maxValue={3000} valueLabel="1,240 of 3,000 rows" />
      <ProgressBar label="Uploading muster.pdf" value={72} tone="success" />
      <ProgressBar label="Preparing the export" />
    </div>
  ),
};

export const Tooltips: Story = {
  render: () => (
    <div className="flex gap-3 pt-10">
      <Tooltip content="Download the muster as a spreadsheet">
        <IconButton icon="download" label="Download" variant="secondary" />
      </Tooltip>
      <Tooltip content="Only the Manager can reopen a closed period" placement="bottom">
        <Button variant="secondary">Why is this locked?</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button', { name: 'Download' })).toHaveFocus();
    const tip = await within(document.body).findByRole('tooltip');
    await expect(tip).toHaveTextContent('Download the muster as a spreadsheet');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('tooltip')).not.toBeInTheDocument());
  },
};
