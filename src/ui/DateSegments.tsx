import { type ReactNode } from 'react';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateSegment,
  Heading,
  RangeCalendar,
} from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';

/** Typed entry: each part of the date or time is its own spin button (type digits or use the arrow keys). */
export function Segments({
  className,
  slot,
}: {
  readonly className?: string;
  readonly slot?: 'start' | 'end';
}) {
  return (
    <DateInput {...(slot ? { slot } : {})} className={cx('flex flex-1 items-center py-1.5', className)}>
      {(segment) => (
        <DateSegment
          segment={segment}
          className={cx(
            'rounded-sm px-0.5 text-base text-fg tabular-nums figures outline-none',
            'data-placeholder:text-fg-subtle',
            'data-[type=literal]:px-0 data-[type=literal]:text-fg-muted',
            'data-focused:bg-primary data-focused:text-fg-on-primary',
          )}
        />
      )}
    </DateInput>
  );
}

const navButton =
  'flex size-9 items-center justify-center rounded-md text-fg-muted data-hovered:bg-surface-subtle data-focus-visible:outline-2 data-focus-visible:outline-focus';

const cellBase = cx(
  'flex size-9 cursor-default items-center justify-center rounded-md text-sm text-fg outline-none',
  'data-hovered:bg-surface-subtle',
  'data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-focus',
  'data-outside-month:hidden',
  'data-disabled:text-fg-subtle data-unavailable:text-fg-subtle data-unavailable:line-through',
);

function CalendarHeader() {
  return (
    <header className="mb-2 flex items-center justify-between gap-2">
      <Button slot="previous" className={navButton} aria-label="Previous month">
        <Icon name="chevronLeft" size="sm" />
      </Button>
      <Heading className="text-base font-semibold text-fg" />
      <Button slot="next" className={navButton} aria-label="Next month">
        <Icon name="chevronRight" size="sm" />
      </Button>
    </header>
  );
}

/** A month grid for choosing one date. */
export function SingleCalendar() {
  return (
    <Calendar className="w-fit">
      <CalendarHeader />
      <CalendarGrid className="border-separate border-spacing-0.5">
        {(date) => (
          <CalendarCell
            date={date}
            className={cx(
              cellBase,
              'data-selected:bg-primary data-selected:font-semibold data-selected:text-fg-on-primary',
            )}
          />
        )}
      </CalendarGrid>
    </Calendar>
  );
}

/** A month grid for choosing a start and end date. */
export function RangeMonthCalendar() {
  return (
    <RangeCalendar className="w-fit">
      <CalendarHeader />
      <CalendarGrid className="border-separate border-spacing-0.5">
        {(date) => (
          <CalendarCell
            date={date}
            className={cx(
              cellBase,
              'data-selected:rounded-none data-selected:bg-primary-subtle data-selected:text-primary-strong',
              'data-selection-start:rounded-s-md data-selection-start:bg-primary data-selection-start:text-fg-on-primary',
              'data-selection-end:rounded-e-md data-selection-end:bg-primary data-selection-end:text-fg-on-primary',
            )}
          />
        )}
      </CalendarGrid>
    </RangeCalendar>
  );
}

/** A preset button ("Today", "Last month") in a date popover. */
export function PresetButton({
  children,
  onPress,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
}) {
  return (
    <Button
      onPress={onPress}
      className={cx(
        'rounded-md px-3 py-1.5 text-start text-sm text-primary',
        'min-h-(--size-touch-target) md:min-h-0',
        'data-focus-visible:outline-2 data-focus-visible:outline-focus data-hovered:bg-primary-subtle',
      )}
    >
      {children}
    </Button>
  );
}
