import { CalendarDate, Time } from '@internationalized/date';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DATE_PRESETS,
  DATE_RANGE_PRESETS,
  fromCalendarDate,
  fromTime,
  isBusinessDate,
  isTimeOfDay,
  toCalendarDate,
  todayIn,
  toTime,
} from './dates';

afterEach(() => {
  vi.useRealTimers();
});

/** 2026-10-04 19:30 UTC is already 2026-10-05 01:30 in Dhaka (UTC+6). */
const LATE_EVENING_UTC = new Date('2026-10-04T19:30:00Z');

function freezeAt(instant: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(instant);
}

describe('business dates', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isBusinessDate('2026-10-04')).toBe(true);
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('2026-02-30')).toBe(false);
    expect(isBusinessDate('2026-2-3')).toBe(false);
    expect(isBusinessDate('2026-10-04T00:00:00Z')).toBe(false);
  });

  it('converts to and from a calendar date with no time or zone', () => {
    const date = toCalendarDate('2026-10-04');
    expect(date).toEqual(new CalendarDate(2026, 10, 4));
    expect(fromCalendarDate(date)).toBe('2026-10-04');
    expect(toCalendarDate('not a date')).toBeNull();
    expect(toCalendarDate(null)).toBeNull();
    expect(fromCalendarDate(null)).toBeNull();
  });

  it('never shifts a day, whatever the hour', () => {
    // A JavaScript Date for midnight Dhaka is the previous day in UTC: the CalendarDate path avoids that.
    for (const value of ['2026-01-01', '2026-10-04', '2026-12-31']) {
      expect(fromCalendarDate(toCalendarDate(value))).toBe(value);
    }
  });
});

describe('today in Asia/Dhaka', () => {
  it('is the estate’s date, not UTC’s', () => {
    freezeAt(LATE_EVENING_UTC);
    expect(todayIn()).toBe('2026-10-05');
    expect(todayIn('UTC')).toBe('2026-10-04');
  });

  it('drives the presets', () => {
    freezeAt(LATE_EVENING_UTC);
    const date = (id: string) => DATE_PRESETS.find((p) => p.id === id)?.date();
    const range = (id: string) => DATE_RANGE_PRESETS.find((p) => p.id === id)?.range();
    expect(date('today')).toBe('2026-10-05');
    expect(date('yesterday')).toBe('2026-10-04');
    expect(range('last-7-days')).toEqual({ start: '2026-09-29', end: '2026-10-05' });
    expect(range('this-month')).toEqual({ start: '2026-10-01', end: '2026-10-05' });
    expect(range('last-month')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});

describe('times of day', () => {
  it('accepts 24-hour HH:mm only', () => {
    expect(isTimeOfDay('07:30')).toBe(true);
    expect(isTimeOfDay('23:59')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('7:30')).toBe(false);
    expect(isTimeOfDay('07:30:00')).toBe(false);
  });

  it('converts to and from a Time', () => {
    expect(toTime('07:30')).toEqual(new Time(7, 30));
    expect(fromTime(new Time(7, 30))).toBe('07:30');
    expect(toTime('bad')).toBeNull();
    expect(fromTime(null)).toBeNull();
  });
});
