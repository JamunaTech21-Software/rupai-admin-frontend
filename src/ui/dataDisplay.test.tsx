import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { formatBusinessDate, formatDateTime } from '@/lib/dates';

import { axeViolations } from '../../tests/axe';

import { Accordion } from './Accordion';
import { Card } from './Card';
import { DescriptionList } from './DescriptionList';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { pageWindow } from './pageWindow';
import { StatCard } from './StatCard';
import { Tabs } from './Tabs';
import { Timeline } from './Timeline';
import { Tree } from './Tree';

describe('Card and DescriptionList', () => {
  it('a titled card is a labelled region; empty values read as "Not set"', async () => {
    const { container } = render(
      <Card title="Worker details">
        <DescriptionList
          items={[
            { term: 'Name', description: 'Rahim Uddin' },
            { term: 'NID', description: null },
            { term: 'Rate', description: '৳178.00', isNumeric: true },
          ]}
        />
      </Card>,
    );
    const region = screen.getByRole('region', { name: 'Worker details' });
    const terms = within(region).getAllByRole('term');
    expect(terms.map((t) => t.textContent)).toEqual(['Name', 'NID', 'Rate']);
    expect(within(region).getAllByRole('definition')[1]).toHaveTextContent('Not set');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('StatCard', () => {
  it('shows the figure, its comparison in words, and links to the detail', () => {
    render(
      <MemoryRouter>
        <StatCard
          label="Musters waiting"
          value="14"
          comparison={{ direction: 'up', sentiment: 'negative', text: '5 more than last week' }}
          drillDown={{ href: '/musters?status=submitted', label: 'Review the 14 musters' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('5 more than last week')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review the 14 musters' })).toHaveAttribute(
      'href',
      '/musters?status=submitted',
    );
  });
});

describe('Timeline', () => {
  it('lists events oldest first with actor, state and Dhaka time', () => {
    render(
      <Timeline
        label="Approval history"
        events={[
          {
            id: '1',
            title: 'Submitted',
            state: 'submitted',
            actor: 'Shefali Das',
            at: '2026-10-04T08:05:00Z',
          },
          { id: '2', title: 'Rejected', state: 'rejected', at: '2026-10-04T19:30:00Z', note: 'Over limit.' },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Approval history' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Shefali Das · 4 Oct 2026, 14:05');
    // 19:30 UTC is already the next day in Dhaka.
    expect(items[1]).toHaveTextContent('5 Oct 2026, 01:30');
    expect(items[1]).toHaveTextContent('Over limit.');
    expect(items[1]?.querySelector('time')).toHaveAttribute('datetime', '2026-10-04T19:30:00Z');
  });
});

describe('date display', () => {
  it('formats business dates without drift and instants in Dhaka', () => {
    expect(formatBusinessDate('2026-10-04')).toBe('4 Oct 2026');
    expect(formatBusinessDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatBusinessDate('bad')).toBe('bad');
    expect(formatDateTime('2026-10-04T08:05:00Z')).toBe('4 Oct 2026, 14:05');
    expect(formatDateTime('2026-10-04T08:05:00Z', 'UTC')).toBe('4 Oct 2026, 08:05');
  });
});

describe('Tabs', () => {
  it('switches with arrow keys and skips disabled tabs', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Tabs
        label="Sections"
        onSelectionChange={onSelectionChange}
        items={[
          { id: 'a', label: 'Profile', content: 'Profile panel' },
          { id: 'b', label: 'Loans', isDisabled: true, content: 'Loans panel' },
          { id: 'c', label: 'Payslips', count: 12, content: 'Payslips panel' },
        ]}
      />,
    );
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelectionChange).toHaveBeenLastCalledWith('c');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Payslips panel');
  });
});

describe('Accordion', () => {
  it('opens and closes sections with their header buttons', async () => {
    render(
      <Accordion
        items={[
          { id: 'e', title: 'Earnings', content: 'Plucking ৳4,890.00' },
          { id: 'd', title: 'Deductions', content: 'Provident fund' },
        ]}
      />,
    );
    const earnings = screen.getByRole('button', { name: /Earnings/ });
    expect(earnings).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(earnings);
    expect(earnings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Plucking ৳4,890.00')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Deductions/ }));
    // One open at a time by default.
    expect(earnings).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Tree', () => {
  const items = [
    {
      id: 'rupai',
      label: 'Rupai Estate',
      children: [
        { id: 'd1', label: 'Division 1', children: [{ id: 'd1-s1', label: 'Section 1' }] },
        { id: 'd2', label: 'Division 2' },
      ],
    },
  ];

  it('expands with the keyboard and picks one node', async () => {
    const onSelectionChange = vi.fn();
    render(
      <Tree
        label="Estate hierarchy"
        items={items}
        selectionMode="single"
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(1);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('row', { name: /Division 1/ })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelectionChange).toHaveBeenLastCalledWith('d1');
  });
});

describe('EmptyState', () => {
  it.each(['new', 'no-results', 'done'] as const)('%s has a heading and its action', async (kind) => {
    const { container } = render(
      <EmptyState kind={kind} title="Nothing here" description="Explained." action={<button>Next</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Pagination', () => {
  it('shows the range, marks the current page and moves between pages', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} pageSize={25} totalItems={60} onPageChange={onPageChange} itemLabel="workers" />,
    );
    expect(screen.getByText('1–25 of 60 workers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it('handles an empty list and the last page', () => {
    const { rerender } = render(<Pagination page={1} pageSize={25} totalItems={0} onPageChange={vi.fn()} />);
    expect(screen.getByText('No rows')).toBeInTheDocument();
    rerender(<Pagination page={3} pageSize={25} totalItems={60} onPageChange={vi.fn()} />);
    expect(screen.getByText('51–60 of 60 rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('windows long page lists around the current page', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 50)).toEqual([1, 2, 3, 4, null, 50]);
    expect(pageWindow(25, 50)).toEqual([1, null, 24, 25, 26, null, 50]);
    expect(pageWindow(50, 50)).toEqual([1, null, 47, 48, 49, 50]);
  });
});
