import { type Key, type ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from 'react-aria-components';

import { cx } from './cx';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  /** A count after the label: "Pending 14". */
  readonly count?: number;
  readonly content: ReactNode;
  readonly isDisabled?: boolean;
}

export interface TabsProps {
  /** The tab list's accessible name: "Worker sections". */
  readonly label: string;
  readonly items: readonly TabItem[];
  /**
   * The open tab. Keep it in the URL so a tab can be linked and survives reload:
   * `<Tabs {...useUrlTab('tab', 'overview')} />` (lib/urlState).
   */
  readonly selectedKey?: string;
  readonly onSelectionChange?: (key: string) => void;
  readonly className?: string;
}

/**
 * Sections of one record or screen (Spec P5 §6.3). Arrow keys move between tabs, Tab moves into the panel.
 * Only the open panel is rendered.
 */
export function Tabs({ label, items, selectedKey, onSelectionChange, className }: TabsProps) {
  // Controlled only when given a key. A key in the URL that matches no tab (an old link) falls back to the
  // first tab.
  const known =
    selectedKey === undefined || items.some((item) => item.id === selectedKey) ? selectedKey : items[0]?.id;
  return (
    <AriaTabs
      {...(known !== undefined ? { selectedKey: known } : {})}
      onSelectionChange={(key: Key) => onSelectionChange?.(String(key))}
      disabledKeys={items.filter((item) => item.isDisabled).map((item) => item.id)}
      className={cx('flex flex-col gap-4', className)}
    >
      <TabList aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item) => (
          <Tab
            key={item.id}
            id={item.id}
            className={cx(
              '-mb-px flex shrink-0 cursor-default items-center gap-2 border-b-2 border-transparent px-3 py-2 text-fg-muted outline-none',
              'min-h-(--size-touch-target) md:min-h-0',
              'data-hovered:text-fg',
              'data-selected:border-primary data-selected:font-medium data-selected:text-primary-strong',
              'data-focus-visible:rounded-sm data-focus-visible:outline-2 data-focus-visible:outline-focus',
              'data-disabled:cursor-not-allowed data-disabled:text-fg-subtle',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="rounded-full bg-surface-subtle px-2 text-sm text-fg-muted figures">
                {item.count}
              </span>
            ) : null}
          </Tab>
        ))}
      </TabList>
      {items.map((item) => (
        <TabPanel
          key={item.id}
          id={item.id}
          className="outline-none data-focus-visible:rounded-sm data-focus-visible:outline-2 data-focus-visible:outline-focus"
        >
          {item.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
