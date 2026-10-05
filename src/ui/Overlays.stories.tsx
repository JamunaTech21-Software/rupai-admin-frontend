import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { Input } from './Input';
import { Drawer, Modal, OverlayTrigger } from './Modal';
import { Select } from './Select';

const meta = {
  title: 'Feedback/Modal, Drawer & ConfirmDialog',
  parameters: {
    docs: {
      description: {
        component: [
          'Modal dialogs (Spec P5 §6.4). On open, focus moves inside and is **trapped** there; **Escape** or the',
          'close button closes; the page behind **does not scroll**; on close, focus **returns** to the button',
          'that opened it.',
          '',
          '- **Modal**: a short task in the middle of the screen (full screen on phones).',
          '- **Drawer**: a longer task from the side that keeps the page in view (filters, a record).',
          '- **ConfirmDialog**: asks before an action with consequences. `consequence` and `confirmLabel` are',
          '  required, so it always says what will happen and the button names the action. `tone="danger"` puts',
          '  focus on Cancel first. If `onConfirm` returns a promise that rejects, the error shows in the dialog.',
          '',
          'Use them controlled (`isOpen`/`onOpenChange`) or inside `OverlayTrigger` next to their button.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

export const ModalDialog: Story = {
  render: () => (
    <OverlayTrigger>
      <Button>Edit gang</Button>
      <Modal
        title="Edit gang G-04"
        description="Changes apply from tomorrow's muster."
        footer={
          <>
            <Button variant="secondary" slot="close">
              Cancel
            </Button>
            <Button slot="close">Save gang</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input label="Gang name" hint="As the sardar calls it." />
          <Select
            label="Sardar"
            options={[
              { id: 's1', label: 'Abdul Karim' },
              { id: 's2', label: 'Shefali Das' },
            ]}
          />
        </div>
      </Modal>
    </OverlayTrigger>
  ),
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Edit gang' });
    await userEvent.click(opener);
    const dialog = await body().findByRole('dialog', { name: 'Edit gang G-04' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    // Tab cycles inside the dialog: it never reaches the page behind.
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      await expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

export const DrawerPanel: Story = {
  render: () => (
    <OverlayTrigger>
      <Button variant="secondary" iconStart="filter">
        Filters
      </Button>
      <Drawer
        title="Filter workers"
        footer={
          <>
            <Button variant="secondary" slot="close">
              Clear
            </Button>
            <Button slot="close">Show results</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input label="Name or code" />
          <Select
            label="Division"
            options={[
              { id: 'd1', label: 'Division 1' },
              { id: 'd2', label: 'Division 2' },
            ]}
          />
        </div>
      </Drawer>
    </OverlayTrigger>
  ),
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Filters' });
    await userEvent.click(opener);
    await body().findByRole('dialog', { name: 'Filter workers' });
    await userEvent.click(body().getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

export const ConfirmDestructive: Story = {
  render: () => (
    <OverlayTrigger>
      <Button variant="danger" iconStart="trash">
        Delete gang
      </Button>
      <ConfirmDialog
        tone="danger"
        title="Delete gang G-04?"
        consequence="The 14 workers in G-04 will be unassigned and tomorrow's muster will not list them. This cannot be undone."
        confirmLabel="Delete gang"
        onConfirm={() => undefined}
      />
    </OverlayTrigger>
  ),
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Delete gang' });
    await userEvent.click(opener);
    const dialog = await body().findByRole('alertdialog', { name: 'Delete gang G-04?' });
    // The safe choice is focused first for a destructive action.
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

function FailingConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        onPress={() => {
          setIsOpen(true);
        }}
      >
        Post payroll
      </Button>
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title="Post September payroll?"
        consequence="Wages for 1,240 workers will be posted to the ledger and the period will lock. Corrections after this need a reversal."
        confirmLabel="Post payroll"
        onConfirm={() =>
          new Promise<void>((_resolve, reject) => {
            window.setTimeout(() => {
              reject(new Error('The September period is already closed.'));
            }, 400);
          })
        }
      />
    </>
  );
}

export const ConfirmWithServerError: Story = {
  render: () => <FailingConfirm />,
};
