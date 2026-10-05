import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../tests/axe';

import { Alert } from './Alert';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState } from './ErrorState';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Drawer, Modal, OverlayTrigger } from './Modal';
import { ProgressBar } from './ProgressBar';
import { ToastRegion } from './Toast';
import { toast } from './toastQueue';
import { Tooltip } from './Tooltip';

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

/** Tabs `count` times and checks focus never leaves `container`. */
async function expectFocusTrappedIn(container: HTMLElement, count = 8) {
  for (let i = 0; i < count; i += 1) {
    await userEvent.tab();
    expect(container).toContainElement(document.activeElement as HTMLElement);
  }
  await userEvent.tab({ shift: true });
  expect(container).toContainElement(document.activeElement as HTMLElement);
}

describe('Modal', () => {
  function Page() {
    return (
      <>
        <button type="button">Before</button>
        <OverlayTrigger>
          <Button>Edit gang</Button>
          <Modal
            title="Edit gang G-04"
            description="Changes apply from tomorrow."
            footer={<Button slot="close">Save</Button>}
          >
            <Input label="Gang name" />
          </Modal>
        </OverlayTrigger>
        <button type="button">After</button>
      </>
    );
  }

  it('moves focus inside, traps it, locks scroll, and closes on Escape with focus restored', async () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Edit gang' });
    await userEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Edit gang G-04' });
    expect(dialog).toHaveAccessibleDescription('Changes apply from tomorrow.');
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    expect(document.documentElement.style.overflow).toBe('hidden');
    await expectFocusTrappedIn(dialog);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // React Aria restores focus a frame after the dialog unmounts.
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('closes from the close button and footer buttons, but not from a click outside', async () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Edit gang' });

    await userEvent.click(opener);
    await screen.findByRole('dialog');
    // The backdrop is the fixed overlay around the dialog: clicking it must not lose the user's input.
    const backdrop = screen.getByRole('dialog').closest<HTMLElement>('.fixed');
    if (!backdrop) throw new Error('no backdrop');
    await userEvent.click(backdrop);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // React Aria restores focus a frame after the dialog unmounts.
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });

    await userEvent.click(opener);
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('has no accessibility violations when open', async () => {
    render(
      <Modal isOpen title="Worker detail">
        <p>EMP-00042</p>
      </Modal>,
    );
    expect(await axeViolations(screen.getByRole('dialog'))).toEqual([]);
  });
});

describe('Drawer', () => {
  it('works controlled, traps focus, and returns focus on close', async () => {
    function Page() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <Button
            onPress={() => {
              setIsOpen(true);
            }}
          >
            Filters
          </Button>
          <Drawer isOpen={isOpen} onOpenChange={setIsOpen} title="Filter workers">
            <Input label="Name or code" />
          </Drawer>
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Filter workers' });
    await expectFocusTrappedIn(dialog, 4);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // React Aria restores focus a frame after the dialog unmounts.
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });
});

describe('ConfirmDialog', () => {
  function Confirm({ onConfirm, tone }: { onConfirm: () => void | Promise<void>; tone?: 'danger' }) {
    return (
      <OverlayTrigger>
        <Button>Delete gang</Button>
        <ConfirmDialog
          {...(tone ? { tone } : {})}
          title="Delete gang G-04?"
          consequence="The 14 workers in G-04 will be unassigned. This cannot be undone."
          confirmLabel="Delete gang"
          onConfirm={onConfirm}
        />
      </OverlayTrigger>
    );
  }

  it('is an alert dialog that names the consequence, with Cancel focused first for danger', async () => {
    render(<Confirm tone="danger" onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete gang' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete gang G-04?' });
    expect(dialog).toHaveAccessibleDescription(/14 workers in G-04 will be unassigned/);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    await expectFocusTrappedIn(dialog, 3);
    expect(await axeViolations(dialog)).toEqual([]);
  });

  it('focuses the action for a non-destructive confirm, and runs it once', async () => {
    const onConfirm = vi.fn();
    render(<Confirm onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'Delete gang' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('alertdialog');
    const action = within(dialog).getByRole('button', { name: 'Delete gang' });
    await waitFor(() => {
      expect(action).toHaveFocus();
    });
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    // React Aria restores focus a frame after the dialog unmounts.
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });

  it('cancelling never runs the action', async () => {
    const onConfirm = vi.fn();
    render(<Confirm tone="danger" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete gang' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the error when the action fails', async () => {
    let reject: (reason: Error) => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((_resolve, rej) => {
          reject = rej;
        }),
    );
    render(<Confirm onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete gang' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete gang' }));

    // While pending, Cancel is disabled and Escape does not close it.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await act(async () => {
      reject(new Error('G-04 has workers on today’s muster.'));
      await Promise.resolve();
    });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('G-04 has workers on today’s muster.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('closes after the action succeeds', async () => {
    render(<Confirm onConfirm={() => Promise.resolve()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete gang' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete gang' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});

describe('Toast', () => {
  it('shows success and info toasts in a labelled region, each with a close button', async () => {
    render(<ToastRegion />);
    act(() => {
      toast.success('Muster saved', '212 workers.');
      toast.info('Export started');
    });
    const region = screen.getByRole('region', { name: /Notifications/ });
    expect(within(region).getByText('Muster saved')).toBeInTheDocument();
    expect(within(region).getByText('212 workers.')).toBeInTheDocument();
    expect(within(region).getByText('Export started')).toBeInTheDocument();

    await userEvent.click(within(region).getAllByRole('button', { name: 'Close notification' })[0]!);
    await waitFor(() => {
      expect(within(region).getAllByRole('button', { name: 'Close notification' })).toHaveLength(1);
    });
  });

  it('closes by itself after a readable while', () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => {
      toast.success('Muster saved');
    });
    expect(screen.getByText('Muster saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Muster saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('Muster saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Alert', () => {
  it('announces danger alerts, keeps others quiet, and can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <>
        <Alert tone="danger" title="Could not submit">
          Period closed.
        </Alert>
        <Alert tone="info" title="Rates changed" onDismiss={onDismiss} />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not submit');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText('Rates changed')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('shows what failed, the request id to quote, a copy button and a retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { container } = render(
      <ErrorState title="The muster could not be loaded" requestId="req_123" onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The muster could not be loaded');
    expect(screen.getByText('req_123')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy reference' }));
    expect(writeText).toHaveBeenCalledWith('req_123');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('offers no retry when none is given', () => {
    render(<ErrorState title="No access" />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('reports its value and custom text', () => {
    render(
      <>
        <ProgressBar
          label="Importing workers"
          value={1240}
          maxValue={3000}
          valueLabel="1,240 of 3,000 rows"
        />
        <ProgressBar label="Preparing" />
      </>,
    );
    const bar = screen.getByRole('progressbar', { name: 'Importing workers' });
    expect(bar).toHaveAttribute('aria-valuenow', '1240');
    expect(bar).toHaveAttribute('aria-valuetext', '1,240 of 3,000 rows');
    expect(screen.getByRole('progressbar', { name: 'Preparing' })).not.toHaveAttribute('aria-valuenow');
  });
});

describe('Tooltip', () => {
  it('describes its trigger on keyboard focus and closes on Escape', async () => {
    render(
      <Tooltip content="Download as a spreadsheet">
        <IconButton icon="download" label="Download" />
      </Tooltip>,
    );
    await userEvent.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Download as a spreadsheet');
    expect(screen.getByRole('button', { name: 'Download' })).toHaveAccessibleDescription(
      'Download as a spreadsheet',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
