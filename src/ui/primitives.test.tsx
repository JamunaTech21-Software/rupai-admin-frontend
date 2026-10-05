import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../tests/axe';

import { announce } from './announce';
import { Avatar } from './Avatar';
import { initialsOf } from './initials';
import { Badge } from './Badge';
import { Button } from './Button';
import { Divider } from './Divider';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Link } from './Link';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';
import { Tag } from './Tag';

describe('Button', () => {
  it('is pressed with the keyboard (Enter and Space) and keeps focus', async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Approve payroll</Button>);
    await userEvent.tab();
    const button = screen.getByRole('button', { name: 'Approve payroll' });
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('keeps its label while pending, and ignores presses', async () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} isPending>
        Approving
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Approving/ });
    expect(button).toHaveTextContent('Approving');
    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('cannot be pressed when disabled', async () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} isDisabled>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('IconButton', () => {
  it('uses its required label as the accessible name', () => {
    render(<IconButton icon="trash" label="Delete worker" />);
    expect(screen.getByRole('button', { name: 'Delete worker' })).toBeInTheDocument();
  });

  it('refuses an empty label in development', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<IconButton icon="trash" label=" " />)).toThrow(/non-empty `label`/);
  });
});

describe('Link', () => {
  it('renders a real link to its href', () => {
    render(<Link href="/workers">View all workers</Link>);
    expect(screen.getByRole('link', { name: 'View all workers' })).toHaveAttribute('href', '/workers');
  });

  it('marks an external link as opening a new tab, for everyone', () => {
    render(
      <Link href="https://example.org" isExternal>
        Tea Board
      </Link>,
    );
    const link = screen.getByRole('link', { name: /Tea Board.*opens in a new tab/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Badge', () => {
  it('always shows its label, with a decorative icon', () => {
    const { container } = render(<Badge tone="rejected" label="Rejected" />);
    expect(screen.getByText('Rejected')).toBeVisible();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Tag', () => {
  it('names its remove button after the tag and removes with the keyboard', async () => {
    const onRemove = vi.fn();
    render(<Tag label="Division 3" onRemove={onRemove} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Remove Division 3' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('Avatar', () => {
  it('takes whole graphemes for initials, including Bengali', () => {
    expect(initialsOf('Rahim Uddin')).toBe('RU');
    expect(initialsOf('রহিম উদ্দিন')).toBe('রউ');
    // A conjunct (ka + virama + ssa) is one grapheme: never a half letter ending in a virama.
    expect(initialsOf('ক্ষমা')).toBe('ক্ষ');
    expect(initialsOf('  ')).toBe('');
  });

  it('is named by the person, or hidden when decorative', () => {
    const { rerender } = render(<Avatar name="Rahim Uddin" />);
    expect(screen.getByRole('img', { name: 'Rahim Uddin' })).toBeInTheDocument();
    rerender(<Avatar name="" />);
    expect(screen.getByRole('img', { name: 'Unnamed person' })).toBeInTheDocument();
    rerender(<Avatar name="Rahim Uddin" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls back to initials when the photo fails', () => {
    const { container } = render(<Avatar name="Rahim Uddin" src="/missing.png" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    act(() => {
      img?.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('RU')).toBeInTheDocument();
  });
});

describe('Spinner, Skeleton, Divider and Icon', () => {
  it('Spinner announces its label as a status, or is silent with label={null}', () => {
    const { rerender } = render(<Spinner label="Loading the muster" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the muster');
    rerender(<Spinner label={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton variant="table-row" columns={3} rows={2} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('Divider is a separator unless decorative', () => {
    const { rerender } = render(<Divider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    rerender(<Divider decorative />);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('Icon is decorative unless labelled', () => {
    const { rerender, container } = render(<Icon name="leaf" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Icon name="alert" label="Warning" />);
    expect(screen.getByRole('img', { name: 'Warning' })).toBeInTheDocument();
  });
});

describe('announce', () => {
  it('writes the message to a polite live region', async () => {
    announce('Payroll approved');
    const region = document.getElementById('rupai-live-polite');
    expect(region).toHaveAttribute('aria-live', 'polite');
    await vi.waitFor(() => {
      expect(region).toHaveTextContent('Payroll approved');
    });
  });
});

describe('accessibility', () => {
  it('has no axe violations across the primitives', async () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Button isPending>Saving</Button>
        <IconButton icon="close" label="Close" />
        <Link href="/x">Go</Link>
        <Badge tone="approved" label="Approved" />
        <Tag label="Division 3" onRemove={() => undefined} />
        <Avatar name="Rahim Uddin" />
        <Spinner />
        <Divider />
      </div>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
