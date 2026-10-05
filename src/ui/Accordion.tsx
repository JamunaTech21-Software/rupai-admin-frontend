import { type ReactNode } from 'react';
import { Button, Disclosure, DisclosureGroup, DisclosurePanel, Heading } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';

export interface AccordionItem {
  readonly id: string;
  readonly title: string;
  /** A short summary shown on the header while closed: "3 deductions". */
  readonly summary?: string;
  readonly content: ReactNode;
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[];
  /** Let several sections be open at once. */
  readonly allowsMultipleExpanded?: boolean;
  readonly defaultExpandedKeys?: readonly string[];
  /** Heading level of each section title in the page outline. */
  readonly headingLevel?: 2 | 3 | 4;
  readonly className?: string;
}

/** Sections that open and close (a payslip's breakdown, rarely used settings). Each header is a button. */
export function Accordion({
  items,
  allowsMultipleExpanded = false,
  defaultExpandedKeys = [],
  headingLevel = 3,
  className,
}: AccordionProps) {
  return (
    <DisclosureGroup
      allowsMultipleExpanded={allowsMultipleExpanded}
      defaultExpandedKeys={[...defaultExpandedKeys]}
      className={cx('divide-y divide-line rounded-lg border border-line bg-surface', className)}
    >
      {items.map((item) => (
        <Disclosure key={item.id} id={item.id} className="group">
          <Heading level={headingLevel} className="m-0">
            <Button
              slot="trigger"
              className={cx(
                'flex w-full items-center gap-3 px-4 py-3 text-start text-fg outline-none',
                'min-h-(--size-touch-target)',
                'data-hovered:bg-surface-subtle',
                'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
              )}
            >
              <Icon
                name="chevronRight"
                size="sm"
                className="shrink-0 text-fg-muted transition-transform group-data-expanded:rotate-90 motion-reduce:transition-none"
              />
              <span className="flex-1 font-medium">{item.title}</span>
              {item.summary ? <span className="text-sm text-fg-muted">{item.summary}</span> : null}
            </Button>
          </Heading>
          <DisclosurePanel className="px-4 ps-11 pb-4">{item.content}</DisclosurePanel>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
