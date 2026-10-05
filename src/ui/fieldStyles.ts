import { type Ref } from 'react';

import { cx } from './cx';

/**
 * Props shared by every form control. `label` is required: it is the control's accessible name. Spread a
 * `useFormField(...)` binding onto a control to connect it to a form.
 */
export interface FieldProps {
  readonly label: string;
  /** Hide the label visually (a cell in an editable table); it is still the accessible name. */
  readonly hideLabel?: boolean;
  /** Help shown under the control and linked to it with aria-describedby. */
  readonly hint?: string;
  /** The current error. Shows under the control, marks it invalid and is announced. */
  readonly error?: string | undefined;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean | undefined;
  readonly isReadOnly?: boolean;
  readonly name?: string;
  readonly onBlur?: () => void;
  /** Lets a form focus this control (the first error is focused on submit). */
  readonly inputRef?: Ref<HTMLElement>;
  readonly className?: string;
}

export const fieldWrapper = 'flex flex-col gap-1';

/** Height: 44 px below md (touch), --size-control from md up. */
export const controlHeight = 'min-h-(--size-touch-target) md:min-h-(--size-control)';

/** The box around an input: border, background, focus ring on the whole box, invalid and disabled looks. */
export const controlBox = cx(
  'flex w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-base text-fg',
  'transition-colors duration-(--duration-fast)',
  'data-hovered:border-fg-muted',
  'data-focus-within:outline-2 data-focus-within:outline-offset-1 data-focus-within:outline-focus',
  'data-invalid:border-danger',
  'data-disabled:cursor-not-allowed data-disabled:bg-surface-subtle data-disabled:text-fg-subtle',
  controlHeight,
);

/** The input inside a controlBox: transparent, no ring of its own (the box shows it). */
export const innerInput =
  'min-w-0 flex-1 bg-transparent py-1.5 text-base text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none disabled:cursor-not-allowed';

/** A button that opens a popover (Select, MultiSelect). */
export const triggerButton = cx(
  'flex w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-surface px-3 text-start text-base text-fg',
  'data-hovered:border-fg-muted',
  'data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-focus',
  'data-disabled:cursor-not-allowed data-disabled:bg-surface-subtle data-disabled:text-fg-subtle',
  controlHeight,
);

export const popover = cx(
  'z-(--z-dropdown) min-w-(--trigger-width) overflow-auto rounded-md border border-line bg-surface p-1 shadow-lg',
  'max-h-72 outline-none',
);

export const listItem = cx(
  'flex cursor-default items-center justify-between gap-2 rounded-sm px-3 py-2 text-base text-fg outline-none',
  'min-h-(--size-touch-target) md:min-h-0',
  'data-focused:bg-primary-subtle data-focused:text-primary-strong',
  'data-selected:font-medium',
  'data-disabled:cursor-not-allowed data-disabled:text-fg-subtle',
);
