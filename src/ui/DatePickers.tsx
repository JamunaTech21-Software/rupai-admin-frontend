import { type Ref, useContext, useImperativeHandle, useRef } from 'react';
import {
  Button,
  DatePicker as AriaDatePicker,
  DatePickerStateContext,
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerStateContext,
  Dialog,
  Group,
  Popover,
  TimeField,
} from 'react-aria-components';

import {
  APP_TIMEZONE,
  type BusinessDateRange,
  DATE_PRESETS,
  DATE_RANGE_PRESETS,
  fromCalendarDate,
  fromTime,
  toCalendarDate,
  toTime,
} from '@/lib/dates';
import { type BusinessDate } from '@/types';

import { cx } from './cx';
import { PresetButton, RangeMonthCalendar, Segments, SingleCalendar } from './DateSegments';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { controlBox, type FieldProps, fieldWrapper } from './fieldStyles';
import { Icon } from './Icon';

/**
 * A date or time field has no single input: give the form a focus target that moves to the first segment, so
 * "focus the first error" lands inside the field.
 */
function useSegmentFocus(inputRef: Ref<HTMLElement> | undefined) {
  const container = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    inputRef,
    () =>
      ({
        focus: () => container.current?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus(),
      }) as HTMLElement,
    [],
  );
  return container;
}

const calendarButton =
  'flex size-8 shrink-0 items-center justify-center rounded-sm text-fg-muted data-hovered:bg-surface-subtle data-focus-visible:outline-2 data-focus-visible:outline-focus';
const datePopover = 'z-(--z-dropdown) rounded-lg border border-line bg-surface p-3 shadow-lg outline-none';

interface DateBounds {
  /** Earliest allowed business date (inclusive). */
  readonly minValue?: BusinessDate;
  /** Latest allowed business date (inclusive). */
  readonly maxValue?: BusinessDate;
  /** The timezone "Today" is computed in. Defaults to the estate's (Asia/Dhaka). */
  readonly timeZone?: string;
}

function boundsProps({ minValue, maxValue }: DateBounds) {
  const min = toCalendarDate(minValue);
  const max = toCalendarDate(maxValue);
  return { ...(min ? { minValue: min } : {}), ...(max ? { maxValue: max } : {}) };
}

function DatePresets({ timeZone }: { readonly timeZone: string }) {
  const state = useContext(DatePickerStateContext);
  return (
    <div className="mt-2 flex gap-1 border-t border-line pt-2">
      {DATE_PRESETS.map((preset) => (
        <PresetButton
          key={preset.id}
          onPress={() => {
            const date = toCalendarDate(preset.date(timeZone));
            if (date) state?.setValue(date);
            state?.close();
          }}
        >
          {preset.label}
        </PresetButton>
      ))}
    </div>
  );
}

export interface DatePickerProps extends FieldProps, DateBounds {
  /** A business date `YYYY-MM-DD` or null. */
  readonly value?: BusinessDate | string | null | undefined;
  readonly onChange?: (value: BusinessDate | null) => void;
}

/**
 * A business date: typed day/month/year segments or the calendar, plus Today/Yesterday presets. It works on a
 * calendar date with no time or zone, so the value can never shift by a day.
 */
export function DatePicker({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  inputRef,
  className,
  value,
  onChange,
  timeZone = APP_TIMEZONE,
  ...bounds
}: DatePickerProps) {
  const focusRef = useSegmentFocus(inputRef);
  return (
    <AriaDatePicker
      value={toCalendarDate(value)}
      onChange={(date) => onChange?.(fromCalendarDate(date))}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      {...boundsProps(bounds)}
      granularity="day"
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Group
        ref={focusRef}
        className={cx(controlBox, 'pe-1')}
        isInvalid={Boolean(error)}
        isDisabled={isDisabled ?? false}
      >
        <Segments />
        <Button className={calendarButton}>
          <Icon name="calendar" size="sm" />
        </Button>
      </Group>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
      <Popover className={datePopover}>
        <Dialog className="outline-none" aria-label={`${label}: calendar`}>
          <SingleCalendar />
          <DatePresets timeZone={timeZone} />
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}

function RangePresets({ timeZone }: { readonly timeZone: string }) {
  const state = useContext(DateRangePickerStateContext);
  return (
    <div className="flex flex-col gap-0.5 border-b border-line pb-2 sm:border-e sm:border-b-0 sm:pe-2 sm:pb-0">
      {DATE_RANGE_PRESETS.map((preset) => (
        <PresetButton
          key={preset.id}
          onPress={() => {
            const range = preset.range(timeZone);
            const start = toCalendarDate(range.start);
            const end = toCalendarDate(range.end);
            if (start && end) state?.setValue({ start, end });
            state?.close();
          }}
        >
          {preset.label}
        </PresetButton>
      ))}
    </div>
  );
}

export interface DateRangePickerProps extends FieldProps, DateBounds {
  readonly value?: BusinessDateRange | null | undefined;
  readonly onChange?: (value: BusinessDateRange | null) => void;
}

/** A period of business dates (a report range, a pay period), with presets such as "Last month". */
export function DateRangePicker({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  inputRef,
  className,
  value,
  onChange,
  timeZone = APP_TIMEZONE,
  ...bounds
}: DateRangePickerProps) {
  const focusRef = useSegmentFocus(inputRef);
  const start = toCalendarDate(value?.start);
  const end = toCalendarDate(value?.end);
  return (
    <AriaDateRangePicker
      value={start && end ? { start, end } : null}
      onChange={(range) => {
        const from = fromCalendarDate(range?.start);
        const to = fromCalendarDate(range?.end);
        onChange?.(from && to ? { start: from, end: to } : null);
      }}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { startName: `${name}.start`, endName: `${name}.end` } : {})}
      {...boundsProps(bounds)}
      granularity="day"
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Group
        ref={focusRef}
        className={cx(controlBox, 'pe-1')}
        isInvalid={Boolean(error)}
        isDisabled={isDisabled ?? false}
      >
        <Segments slot="start" className="flex-none" />
        <span aria-hidden="true" className="px-1 text-fg-muted">
          –
        </span>
        <Segments slot="end" />
        <Button className={calendarButton}>
          <Icon name="calendar" size="sm" />
        </Button>
      </Group>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
      <Popover className={datePopover}>
        <Dialog className="flex flex-col gap-2 outline-none sm:flex-row" aria-label={`${label}: calendar`}>
          <RangePresets timeZone={timeZone} />
          <RangeMonthCalendar />
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}

export interface TimeInputProps extends FieldProps {
  /** A time of day `HH:mm` (24-hour) or null. */
  readonly value?: string | null | undefined;
  readonly onChange?: (value: string | null) => void;
  /** 24-hour by default (shift times); 12 shows AM/PM. */
  readonly hourCycle?: 12 | 24;
}

/** A time of day typed as hour and minute segments (a shift start, a weighing time). */
export function TimeInput({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  inputRef,
  className,
  value,
  onChange,
  hourCycle = 24,
}: TimeInputProps) {
  const focusRef = useSegmentFocus(inputRef);
  return (
    <TimeField
      value={toTime(value)}
      onChange={(time) => onChange?.(fromTime(time))}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      hourCycle={hourCycle}
      granularity="minute"
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div ref={focusRef} className={cx(controlBox, 'w-fit min-w-32')}>
        <Segments />
        <Icon name="clock" size="sm" className="text-fg-muted" />
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
    </TimeField>
  );
}
