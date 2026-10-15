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

// As the design (R.1): 13 px items with muted icons; hover tints green; the current page is solid primary.
const itemBase = cx(
  'group flex w-full items-center gap-2.5 rounded-md px-3 text-start text-nav font-medium text-fg-muted outline-none',
  'transition-colors duration-(--duration-fast)',
  'min-h-(--size-touch-target) md:min-h-9',
  'data-hovered:bg-primary-subtle data-hovered:text-primary',
  'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
);
const itemCurrent =
  'bg-primary text-fg-on-primary shadow-sm data-hovered:bg-primary-hover data-hovered:text-fg-on-primary';
const iconLook = 'shrink-0 text-fg-subtle group-data-hovered:text-primary';
const iconCurrent = 'text-fg-on-primary group-data-hovered:text-fg-on-primary';
/** A page inside a group: smaller, on a rule; the current one is tinted, not solid. */
const subItem = cx(
  'flex w-full items-center rounded-md px-2.5 text-start text-xs font-medium text-fg-muted outline-none',
  'min-h-(--size-touch-target) md:min-h-8',
  'data-hovered:bg-primary-subtle data-hovered:text-primary',
  'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
);
const subItemCurrent = 'bg-primary-subtle text-primary-strong';

function Count({ value }: { readonly value: number }) {
  const text = useUiText();
  return (
    <span className="ms-auto rounded-full bg-primary px-2 text-xs font-semibold text-fg-on-primary figures">
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">{text.needAttention(String(value))}</span>
    </span>
  );
}

function NavLinkEntry({
  item,
  currentPath,
  isCollapsed,
  isSub,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly currentPath: string;
  readonly isCollapsed: boolean;
  readonly isSub: boolean;
  readonly onNavigate: (() => void) | undefined;
}) {
  // Marked on its own pages too (a user's detail under Users); aria-current only on the page itself.
  const isCurrent = isActive(item, currentPath);
  // In the rail a group links to its first child, so every icon still goes somewhere.
  const href = item.href ?? item.children?.[0]?.href;
  const look = isSub
    ? cx(subItem, isCurrent && subItemCurrent)
    : cx(itemBase, isCollapsed && 'justify-center px-0', isCurrent && itemCurrent);
  return (
    <li>
      <AriaLink
        {...(href ? { href } : {})}
        {...(item.href === currentPath ? { 'aria-current': 'page' as const } : {})}
        {...(isCollapsed ? { 'aria-label': item.label } : {})}
        {...(onNavigate ? { onPress: onNavigate } : {})}
        className={look}
      >
        {item.icon && !isSub ? (
          <Icon name={item.icon} size="sm" className={cx(iconLook, isCurrent && iconCurrent)} />
        ) : null}
        {isCollapsed ? (
          <span className="sr-only">{item.label}</span>
        ) : (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {item.badge !== undefined && !isCollapsed ? <Count value={item.badge} /> : null}
      </AriaLink>
    </li>
  );
}

function NavGroup({
  item,
  currentPath,
  isOpen,
  onToggle,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly currentPath: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onNavigate: (() => void) | undefined;
}) {
  const active = isActive(item, currentPath);
  return (
    <li>
      <AriaButton aria-expanded={isOpen} onPress={onToggle} className={cx(itemBase, active && itemCurrent)}>
        {item.icon ? (
          <Icon name={item.icon} size="sm" className={cx(iconLook, active && iconCurrent)} />
        ) : null}
        <span className="flex-1 truncate">{item.label}</span>
        <Icon
          name="chevronRight"
          size="sm"
          className={cx(
            'shrink-0 transition-transform duration-(--duration-base) motion-reduce:transition-none',
            isOpen && 'rotate-90',
            active ? 'text-fg-on-primary' : 'text-fg-subtle',
          )}
        />
      </AriaButton>
      {isOpen ? (
        <ul className="ms-5 mt-0.5 flex flex-col gap-0.5 border-s border-line py-1 ps-3">
          {(item.children ?? []).map((child) => (
            <NavLinkEntry
              key={child.id}
              item={child}
              currentPath={currentPath}
              isCollapsed={false}
              isSub
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The group holding the current page, which opens by itself. */
function activeGroupOf(sections: readonly NavSection[], path: string): string | null {
  for (const section of sections)
    for (const item of section.items)
      if (item.children && item.children.length > 0 && isActive(item, path)) return item.id;
  return null;
}

/**
 * The main navigation (Spec P5 §6.5, design R.1): sections of links and groups, one group open at a time (the
 * one holding the current page opens by itself), the current page marked.
 */
export function Sidebar({ sections, currentPath, isCollapsed = false, onNavigate, className }: SidebarProps) {
  const text = useUiText();
  const activeGroup = activeGroupOf(sections, currentPath);
  const [open, setOpen] = useState<{ readonly id: string | null; readonly forPath: string }>({
    id: activeGroup,
    forPath: currentPath,
  });
  // Moving to another page opens that page's group (state adjusted while rendering, not in an effect).
  if (open.forPath !== currentPath) setOpen({ id: activeGroup ?? open.id, forPath: currentPath });

  return (
    <nav
      aria-label={text.mainNavigation}
      className={cx('flex flex-col gap-3 overflow-x-hidden overflow-y-auto px-2 py-3', className)}
    >
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1.5">
          {section.title ? (
            <h2
              className={cx(
                'px-3 text-2xs font-semibold tracking-wider text-fg-subtle uppercase',
                isCollapsed && 'sr-only',
              )}
            >
              {section.title}
            </h2>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) =>
              item.children && item.children.length > 0 && !isCollapsed ? (
                <NavGroup
                  key={item.id}
                  item={item}
                  currentPath={currentPath}
                  isOpen={open.id === item.id}
                  onToggle={() => {
                    setOpen({ id: open.id === item.id ? null : item.id, forPath: currentPath });
                  }}
                  onNavigate={onNavigate}
                />
              ) : (
                <NavLinkEntry
                  key={item.id}
                  item={item}
                  currentPath={currentPath}
                  isCollapsed={isCollapsed}
                  isSub={false}
                  onNavigate={onNavigate}
                />
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
