import {
  type CalendarDate,
  endOfMonth,
  parseDate,
  parseTime,
  startOfMonth,
  type Time,
  today,
} from '@internationalized/date';

import { type BusinessDate } from '@/types';

/**
 * Business dates without timezone drift (Spec P4 §2.3). A business date is a plain `YYYY-MM-DD` with no time
 * and no zone; it is handled as a CalendarDate, never a JavaScript Date, so it cannot shift by a day.
 */

/** The estate's display timezone (the backend's APP_TIMEZONE). "Today" is today here, not in the browser. */
export const APP_TIMEZONE = 'Asia/Dhaka';

const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed, real calendar date string (2026-02-30 is not). */
export function isBusinessDate(value: string): value is BusinessDate {
  if (!BUSINESS_DATE.test(value)) return false;
  try {
    return parseDate(value).toString() === value;
  } catch {
    return false;
  }
}

export function toCalendarDate(value: string | null | undefined): CalendarDate | null {
  return value && isBusinessDate(value) ? parseDate(value) : null;
}

export function fromCalendarDate(date: CalendarDate | null | undefined): BusinessDate | null {
  return date ? (date.toString() as BusinessDate) : null;
}

/** Today in the estate's timezone. */
export function todayIn(timeZone: string = APP_TIMEZONE): BusinessDate {
  return today(timeZone).toString() as BusinessDate;
}

export interface BusinessDateRange {
  readonly start: BusinessDate;
  readonly end: BusinessDate;
}

export interface DatePreset {
  readonly id: string;
  readonly label: string;
  readonly date: (timeZone?: string) => BusinessDate;
}

export interface DateRangePreset {
  readonly id: string;
  readonly label: string;
  readonly range: (timeZone?: string) => BusinessDateRange;
}

const day = (timeZone: string) => today(timeZone);
const str = (date: CalendarDate) => date.toString() as BusinessDate;

export const DATE_PRESETS: readonly DatePreset[] = [
  { id: 'today', label: 'Today', date: (tz = APP_TIMEZONE) => str(day(tz)) },
  { id: 'yesterday', label: 'Yesterday', date: (tz = APP_TIMEZONE) => str(day(tz).subtract({ days: 1 })) },
];

export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  {
    id: 'today',
    label: 'Today',
    range: (tz = APP_TIMEZONE) => ({ start: str(day(tz)), end: str(day(tz)) }),
  },
  {
    id: 'last-7-days',
    label: 'Last 7 days',
    range: (tz = APP_TIMEZONE) => ({ start: str(day(tz).subtract({ days: 6 })), end: str(day(tz)) }),
  },
  {
    id: 'this-month',
    label: 'This month',
    range: (tz = APP_TIMEZONE) => ({ start: str(startOfMonth(day(tz))), end: str(day(tz)) }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: (tz = APP_TIMEZONE) => {
      const previous = startOfMonth(day(tz)).subtract({ months: 1 });
      return { start: str(previous), end: str(endOfMonth(previous)) };
    },
  },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A time of day as `HH:mm` (24-hour), e.g. a shift start. */
export function isTimeOfDay(value: string): boolean {
  return TIME.test(value);
}

export function toTime(value: string | null | undefined): Time | null {
  return value && isTimeOfDay(value) ? parseTime(value) : null;
}

export function fromTime(time: Time | null | undefined): string | null {
  return time ? time.toString().slice(0, 5) : null;
}
