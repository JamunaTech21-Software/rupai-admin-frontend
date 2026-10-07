import { type Key, type ReactNode } from 'react';
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover, Separator } from 'react-aria-components';

import { Avatar } from './Avatar';
import { cx } from './cx';
import { popover, listItem } from './fieldStyles';
import { Icon } from './Icon';
import { type IconName } from './iconSet';
import { useUiText } from './uiText';

export interface TopBarProps {
  /** The button that opens the navigation (phones) or collapses it (wide screens). */
  readonly menuButton?: ReactNode;
  /** Usually the current page or area: "Payroll". */
  readonly title?: string;
  /** Things at the end: estate switcher, notifications, the user menu. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** The bar across the top of the app (the banner landmark). */
export function TopBar({ menuButton, title, actions, className }: TopBarProps) {
  return (
    <header
      className={cx(
        'sticky top-0 z-(--z-sticky) flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:h-16 sm:px-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {menuButton}
        {title ? (
          <p className="truncate text-base font-semibold text-primary-strong sm:text-lg">{title}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface UserMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Separated from the rest and shown in the danger colour ("Sign out"). */
  readonly isDanger?: boolean;
}

export interface UserMenuProps {
  readonly name: string;
  /** The role or estate under the name: "Manager · Rupai Estate". */
  readonly detail?: string;
  readonly items: readonly UserMenuItem[];
  readonly onAction: (id: string) => void;
}

/** The signed-in person: avatar and name, opening their menu (profile, settings, sign out). */
export function UserMenu({ name, detail, items, onAction }: UserMenuProps) {
  const text = useUiText();
  const regular = items.filter((item) => !item.isDanger);
  const danger = items.filter((item) => item.isDanger);
  const renderItem = (item: UserMenuItem) => (
    <MenuItem
      key={item.id}
      id={item.id}
      textValue={item.label}
      className={cx(listItem, 'justify-start', item.isDanger && 'text-danger data-focused:text-danger')}
    >
      {item.icon ? <Icon name={item.icon} size="sm" /> : null}
      {item.label}
    </MenuItem>
  );
  return (
    <MenuTrigger>
      <AriaButton
        aria-label={text.account(name)}
        className="flex items-center gap-2 rounded-md p-1 outline-none data-focus-visible:outline-2 data-focus-visible:outline-focus data-hovered:bg-surface-subtle"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden flex-col text-start md:flex">
          <span className="text-sm font-medium text-fg">{name}</span>
          {detail ? <span className="text-xs text-fg-muted">{detail}</span> : null}
        </span>
        <Icon name="chevronDown" size="sm" className="hidden text-fg-muted md:block" />
      </AriaButton>
      <Popover className={cx(popover, 'min-w-48')} placement="bottom end">
        <Menu
          onAction={(key: Key) => {
            onAction(String(key));
          }}
          className="outline-none"
        >
          {regular.map(renderItem)}
          {danger.length > 0 && regular.length > 0 ? (
            <Separator className="my-1 border-t border-line" />
          ) : null}
          {danger.map(renderItem)}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export interface ContextSwitcherOption {
  readonly id: string;
  readonly label: string;
}

export interface ContextSwitcherProps {
  /** What is being chosen: "Estate". With the current choice it names the button for screen readers. */
  readonly label: string;
  readonly icon: IconName;
  readonly options: readonly ContextSwitcherOption[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}

/**
 * The working context in the top bar (the estate): a button showing the current choice, opening a single-choice
 * menu. On phones only the icon shows; the accessible name always carries the choice. With one option it is a
 * plain label, as there is nothing to switch.
 */
export function ContextSwitcher({ label, icon, options, value, onChange }: ContextSwitcherProps) {
  const current = options.find((option) => option.id === value) ?? options[0];
  const name = `${label}: ${current?.label ?? ''}`;
  const face = (
    <>
      <Icon name={icon} size="sm" className="shrink-0 text-primary" />
      <span className="hidden max-w-40 truncate md:inline">{current?.label}</span>
    </>
  );
  const faceClass =
    'flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-fg';
  if (options.length <= 1) {
    return (
      <span role="img" aria-label={name} className={cx(faceClass, 'cursor-default')}>
        {face}
      </span>
    );
  }
  return (
    <MenuTrigger>
      <AriaButton
        aria-label={name}
        className={cx(
          faceClass,
          'outline-none data-focus-visible:outline-2 data-focus-visible:outline-focus data-hovered:bg-surface-subtle',
        )}
      >
        {face}
        <Icon name="chevronDown" size="sm" className="hidden text-fg-muted md:block" />
      </AriaButton>
      <Popover className={cx(popover, 'max-h-80 min-w-52 overflow-y-auto')} placement="bottom end">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value]}
          onAction={(key: Key) => {
            onChange(String(key));
          }}
          className="outline-none"
        >
          {options.map((option) => (
            <MenuItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              className={cx(listItem, 'justify-between')}
            >
              {({ isSelected }) => (
                <>
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <Icon name="check" size="sm" className="text-primary" /> : null}
                </>
              )}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
