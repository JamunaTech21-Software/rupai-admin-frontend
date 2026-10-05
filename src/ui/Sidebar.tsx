import { useState } from 'react';
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';
import { useUiText } from './uiText';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  /** Leave out for a group that only opens its children. */
  readonly href?: string;
  readonly icon?: IconName;
  /** A count that needs attention: "3" musters waiting. */
  readonly badge?: number;
  readonly children?: readonly NavItem[];
}

export interface NavSection {
  readonly id: string;
  /** A small heading over the section ("Operations"); leave out for the first. */
  readonly title?: string;
  readonly items: readonly NavItem[];
}

export interface SidebarProps {
  readonly sections: readonly NavSection[];
  /** The current path, to mark the current page (`aria-current="page"`) and open its group. */
  readonly currentPath: string;
  /** Icon-only rail (wide screens). Labels stay available to screen readers. */
  readonly isCollapsed?: boolean;
  /** Called after a link is followed, so the phone drawer can close. */
  readonly onNavigate?: () => void;
  readonly className?: string;
}

function isActive(item: NavItem, path: string): boolean {
  if (item.href && (path === item.href || (item.href !== '/' && path.startsWith(`${item.href}/`))))
    return true;
  return item.children?.some((child) => isActive(child, path)) ?? false;
}

const itemBase = cx(
  'flex w-full items-center gap-3 rounded-md px-3 text-start text-fg-muted outline-none',
  'min-h-(--size-touch-target) md:min-h-10',
  'data-hovered:bg-surface-subtle data-hovered:text-fg',
  'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
);
const itemCurrent = 'bg-primary-subtle font-medium text-primary-strong data-hovered:bg-primary-subtle';

function Count({ value }: { readonly value: number }) {
  const text = useUiText();
  return (
    <span className="ms-auto rounded-full bg-primary px-2 text-xs font-semibold text-fg-on-primary figures">
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">{text.needAttention(String(value))}</span>
    </span>
  );
}

function NavEntry({
  item,
  currentPath,
  isCollapsed,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly currentPath: string;
  readonly isCollapsed: boolean;
  readonly onNavigate: (() => void) | undefined;
}) {
  const active = isActive(item, currentPath);
  const [isOpen, setIsOpen] = useState(active);
  const label = isCollapsed ? (
    <span className="sr-only">{item.label}</span>
  ) : (
    <span className="truncate">{item.label}</span>
  );
  const icon = item.icon ? <Icon name={item.icon} className="shrink-0" /> : null;

  if (item.children && item.children.length > 0 && !isCollapsed) {
    return (
      <li>
        <AriaButton
          aria-expanded={isOpen}
          onPress={() => {
            setIsOpen((open) => !open);
          }}
          className={cx(itemBase, active && !isOpen && 'text-primary-strong')}
        >
          {icon}
          {label}
          <Icon
            name="chevronRight"
            size="sm"
            className={cx(
              'ms-auto shrink-0 transition-transform motion-reduce:transition-none',
              isOpen && 'rotate-90',
            )}
          />
        </AriaButton>
        {isOpen ? (
          <ul className="ms-5 mt-0.5 flex flex-col gap-0.5 border-s border-line ps-2">
            {item.children.map((child) => (
              <NavEntry
                key={child.id}
                item={child}
                currentPath={currentPath}
                isCollapsed={false}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const isCurrent = item.href === currentPath;
  // In the rail a group links to its first child, so every icon still goes somewhere.
  const href = item.href ?? item.children?.[0]?.href;
  return (
    <li>
      <AriaLink
        {...(href ? { href } : {})}
        {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
        {...(isCollapsed ? { 'aria-label': item.label } : {})}
        {...(onNavigate ? { onPress: onNavigate } : {})}
        className={cx(
          itemBase,
          isCollapsed && 'justify-center px-0',
          (isCurrent || (isCollapsed && active)) && itemCurrent,
        )}
      >
        {icon}
        {label}
        {item.badge !== undefined && !isCollapsed ? <Count value={item.badge} /> : null}
      </AriaLink>
    </li>
  );
}

/** The main navigation (Spec P5 §6.5): sections of links, groups that open, the current page marked. */
export function Sidebar({ sections, currentPath, isCollapsed = false, onNavigate, className }: SidebarProps) {
  const text = useUiText();
  return (
    <nav
      aria-label={text.mainNavigation}
      className={cx('flex flex-col gap-4 overflow-y-auto p-3', className)}
    >
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {section.title ? (
            <h2
              className={cx(
                'px-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase',
                isCollapsed && 'sr-only',
              )}
            >
              {section.title}
            </h2>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavEntry
                key={item.id}
                item={item}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
