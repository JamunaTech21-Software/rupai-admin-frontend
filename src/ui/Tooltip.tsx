import { type ReactElement } from 'react';
import { OverlayArrow, Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';

export interface TooltipProps {
  /** Short extra help. Never the only place information lives: touch screens rarely show tooltips. */
  readonly content: string;
  /**
   * The element it describes: a ui Button, IconButton or Link (a React Aria pressable, so hover and keyboard
   * focus both open it).
   */
  readonly children: ReactElement;
  readonly placement?: 'top' | 'bottom' | 'start' | 'end';
  /** Milliseconds of hover before it shows. Keyboard focus shows it at once. */
  readonly delay?: number;
}

/**
 * A short hint on hover or keyboard focus (Spec P5 §6.4), closed with Escape. It describes its trigger
 * (aria-describedby); it never replaces an accessible name, so an IconButton still needs its `label`.
 */
export function Tooltip({ content, children, placement = 'top', delay = 600 }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={8}
        className="z-(--z-tooltip) max-w-xs rounded-md bg-surface-inverse px-2 py-1 text-sm text-fg-inverse shadow-md"
      >
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8" className="fill-surface-inverse">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
