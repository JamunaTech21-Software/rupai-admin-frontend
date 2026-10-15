import { type ReactNode, useState } from 'react';
import { Dialog, Link as AriaLink, Modal as AriaModal, ModalOverlay } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Sidebar, type NavSection } from './Sidebar';
import { TopBar } from './TopBar';
import { useMediaQuery } from './useMediaQuery';
import { useUiText } from './uiText';

/** From lg (1024 px) the sidebar is part of the page (tokens.css); below it, a drawer. */
const LG_UP = '(min-width: 64rem)';
const RAIL_KEY = 'rupai:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(RAIL_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(RAIL_KEY, String(value));
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}

export interface AppShellProps {
  /** The product mark at the top of the sidebar. */
  readonly brand: {
    readonly name: string;
    readonly tagline?: string;
    readonly logoSrc?: string;
    readonly href?: string;
    /** Shown on the card at the foot of the sidebar. */
    readonly version?: string;
  };
  readonly navigation: readonly NavSection[];
  readonly currentPath: string;
  /** The top bar's title: the current area. */
  readonly title?: string;
  /** The top bar's end: estate switcher, notifications, UserMenu. */
  readonly topBarActions?: ReactNode;
  /** Above everything (the environment banner). */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

function Brand({
  brand,
  isCollapsed,
}: {
  readonly brand: AppShellProps['brand'];
  readonly isCollapsed: boolean;
}) {
  return (
    <AriaLink
      href={brand.href ?? '/'}
      className={cx(
        'flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 outline-none sm:h-16',
        'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
        isCollapsed && 'justify-center px-2',
      )}
    >
      {brand.logoSrc ? <img src={brand.logoSrc} alt="" className="size-8 shrink-0 object-contain" /> : null}
      <span className={cx('flex min-w-0 flex-col', isCollapsed && 'sr-only')}>
        <span className="text-lg leading-tight font-bold text-primary">{brand.name}</span>
        {brand.tagline ? (
          <span className="truncate text-2xs font-medium text-fg-subtle">{brand.tagline}</span>
        ) : null}
      </span>
    </AriaLink>
  );
}

/** The product and its version, on a primary card at the foot of the sidebar (design R.1). */
function VersionCard({
  brand,
  isCollapsed,
}: {
  readonly brand: AppShellProps['brand'];
  readonly isCollapsed: boolean;
}) {
  const text = useUiText();
  if (!brand.version) return null;
  const version = text.appVersion(brand.version);
  return (
    <div className={cx('shrink-0 border-t border-line p-3', isCollapsed && 'p-2')}>
      <div
        className={cx(
          'flex items-center gap-2.5 rounded-lg bg-primary px-3.5 py-3 text-fg-on-primary',
          isCollapsed && 'justify-center p-2.5',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fg-on-primary/15">
          <Icon name="leaf" size="sm" />
        </span>
        <span className={cx('flex min-w-0 flex-col', isCollapsed && 'sr-only')}>
          <span className="truncate text-sm font-semibold">{brand.name}</span>
          <span className="text-xs">{version}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The application frame (Spec P5 §6.5), after the RupAi dashboard design: a skip link, the sidebar (permanent
 * from lg, collapsible to an icon rail and remembered; a drawer on smaller screens), the top bar, and the main
 * region. Landmarks: banner, navigation "Main", main.
 */
export function AppShell({
  brand,
  navigation,
  currentPath,
  title,
  topBarActions,
  banner,
  children,
}: AppShellProps) {
  const text = useUiText();
  const isWide = useMediaQuery(LG_UP);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const menuButton = isWide ? (
    <IconButton
      icon={isCollapsed ? 'panelOpen' : 'panelClose'}
      label={isCollapsed ? text.expandNavigation : text.collapseNavigation}
      variant="ghost"
      onPress={() => {
        writeCollapsed(!isCollapsed);
        setIsCollapsed(!isCollapsed);
      }}
    />
  ) : (
    <IconButton
      icon="menu"
      label={text.openNavigation}
      variant="ghost"
      onPress={() => {
        setIsDrawerOpen(true);
      }}
    />
  );

  return (
    // One screen high, as the design: the banner on top, the sidebar filling the rest, the content scrolling on its own.
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <a
        href="#main"
        className="sr-only z-(--z-toast) rounded-md bg-surface px-4 py-2 font-medium text-primary-strong shadow-md focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {text.skipToMain}
      </a>
      {banner}
      <div className="flex min-h-0 flex-1">
        {isWide ? (
          <aside
            className={cx(
              'flex h-full shrink-0 flex-col border-e border-line bg-surface transition-[width] duration-(--duration-base) motion-reduce:transition-none',
              isCollapsed ? 'w-18' : 'w-68',
            )}
          >
            <Brand brand={brand} isCollapsed={isCollapsed} />
            <Sidebar
              sections={navigation}
              currentPath={currentPath}
              isCollapsed={isCollapsed}
              className="min-h-0 flex-1"
            />
            <VersionCard brand={brand} isCollapsed={isCollapsed} />
          </aside>
        ) : (
          <ModalOverlay
            isOpen={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
            isDismissable
            className="fixed inset-0 z-(--z-modal) flex bg-surface-inverse/50"
          >
            <AriaModal className="flex h-dvh w-[min(17rem,85vw)] flex-col bg-surface shadow-(--shadow-overlay)">
              <Dialog aria-label={text.navigation} className="flex h-full flex-col outline-none">
                {({ close }) => (
                  <>
                    <div className="flex items-center justify-between pe-2">
                      <Brand brand={brand} isCollapsed={false} />
                      <IconButton icon="close" label={text.closeNavigation} variant="ghost" onPress={close} />
                    </div>
                    <Sidebar
                      sections={navigation}
                      currentPath={currentPath}
                      onNavigate={close}
                      className="min-h-0 flex-1"
                    />
                    <VersionCard brand={brand} isCollapsed={false} />
                  </>
                )}
              </Dialog>
            </AriaModal>
          </ModalOverlay>
        )}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopBar menuButton={menuButton} {...(title ? { title } : {})} actions={topBarActions} />
          <main id="main" tabIndex={-1} className="flex-1 p-3 outline-none sm:p-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
