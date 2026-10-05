import { cx } from './cx';
import { Icon } from './Icon';
import { useUiText } from './uiText';

export interface Step {
  readonly id: string;
  readonly label: string;
  /** A short detail under the label: "Upload the spreadsheet". */
  readonly description?: string;
}

export interface StepperProps {
  /** The list's accessible name: "Import steps". */
  readonly label: string;
  readonly steps: readonly Step[];
  /** Index of the current step, from 0. Steps before it are complete. */
  readonly currentStep: number;
  readonly orientation?: 'horizontal' | 'vertical';
  readonly className?: string;
}

/**
 * Progress through a multi-step task (an import, a payroll run). It shows where the user is; moving between
 * steps is done by the task's own Back/Next buttons. Each step's state is in its text, not only its colour.
 */
export function Stepper({ label, steps, currentStep, orientation = 'horizontal', className }: StepperProps) {
  const text = useUiText();
  return (
    <ol
      aria-label={label}
      className={cx(
        'flex gap-3',
        orientation === 'horizontal' ? 'flex-col sm:flex-row sm:items-start' : 'flex-col',
        className,
      )}
    >
      {steps.map((step, index) => {
        const state = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <li
            key={step.id}
            {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            className="flex flex-1 items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={cx(
                'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold figures',
                state === 'complete' && 'border-primary bg-primary text-fg-on-primary',
                state === 'current' && 'border-primary bg-surface text-primary',
                state === 'upcoming' && 'border-line-strong bg-surface text-fg-muted',
              )}
            >
              {state === 'complete' ? <Icon name="check" size="sm" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-1">
              <span className={cx('font-medium', state === 'upcoming' ? 'text-fg-muted' : 'text-fg')}>
                {step.label}
              </span>
              {step.description ? <span className="text-sm text-fg-muted">{step.description}</span> : null}
              <span className="sr-only">{text.step(String(index + 1), String(steps.length), state)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
