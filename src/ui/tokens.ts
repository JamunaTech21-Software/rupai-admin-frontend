/**
 * Catalogue of the design tokens in styles/tokens.css: what each one is for, and which colour pairs must meet
 * WCAG AA. tokens.test.ts keeps this list and the CSS in step, and checks every contrast pair.
 */

export interface Token {
  /** The CSS custom property, e.g. `--color-surface`. */
  readonly name: string;
  /** What the token is for. */
  readonly use: string;
}

export interface TokenGroup {
  readonly id: string;
  readonly title: string;
  readonly tokens: readonly Token[];
}

/** Document states with a colour pair each (Spec P5 §5). */
export const DOCUMENT_STATES = ['draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled'] as const;
export type DocumentState = (typeof DOCUMENT_STATES)[number];

export const FEEDBACK_ROLES = ['success', 'warning', 'danger', 'info'] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

const t = (name: string, use: string): Token => ({ name, use });

export const COLOR_GROUPS: readonly TokenGroup[] = [
  {
    id: 'neutrals',
    title: 'Neutrals',
    tokens: [
      t('--color-canvas', 'Page background'),
      t('--color-surface', 'Cards, panels, inputs'),
      t('--color-surface-subtle', 'Table headers, hovered rows, read-only fields'),
      t('--color-surface-inverse', 'Tooltips, the environment banner'),
      t('--color-fg', 'Primary text'),
      t('--color-fg-muted', 'Secondary text, labels'),
      t('--color-fg-subtle', 'Hints, placeholders, metadata'),
      t('--color-fg-on-primary', 'Text on primary and on solid feedback colours'),
      t('--color-fg-inverse', 'Text on surface-inverse'),
      t('--color-line', 'Decorative dividers and card borders'),
      t('--color-line-strong', 'Borders that identify a control (3:1)'),
    ],
  },
  {
    id: 'brand',
    title: 'Brand and interaction',
    tokens: [
      t('--color-primary', 'Primary actions, links, the active nav item'),
      t('--color-primary-hover', 'Primary hover and pressed'),
      t('--color-primary-subtle', 'Selected rows, the active nav background'),
      t('--color-primary-strong', 'Text on primary-subtle'),
      t('--color-focus', 'The focus ring'),
    ],
  },
  {
    id: 'feedback',
    title: 'Feedback',
    tokens: FEEDBACK_ROLES.flatMap((role) => [
      t(`--color-${role}`, `${role}: text and icons, or a solid background`),
      t(`--color-${role}-subtle`, `${role}: tinted background`),
    ]),
  },
  {
    id: 'states',
    title: 'Document states',
    tokens: DOCUMENT_STATES.flatMap((state) => [
      t(`--color-state-${state}`, `${state}: label text and border`),
      t(`--color-state-${state}-subtle`, `${state}: badge background`),
    ]),
  },
];

export const FONT_TOKENS: readonly Token[] = [
  t('--font-sans', 'All interface text: Inter, falling back to Noto Sans Bengali for Bengali'),
  t('--font-mono', 'Codes and identifiers'),
];

/** The type scale, ratio 1.200 from a 16 px base. */
export const TEXT_TOKENS: readonly Token[] = [
  t('--text-xs', 'Captions only, never body text'),
  t('--text-sm', 'Metadata, table secondary text'),
  t('--text-base', 'Body text and inputs (the minimum on mobile)'),
  t('--text-lg', 'Emphasised body, card titles'),
  t('--text-xl', 'Section titles'),
  t('--text-2xl', 'Page titles'),
  t('--text-3xl', 'Large headings'),
  t('--text-4xl', 'Dashboard figures'),
];

export const SPACING_TOKENS: readonly Token[] = [
  t('--spacing', 'The 4 px grid unit: p-1 = 4 px, p-4 = 16 px'),
];

export const RADIUS_TOKENS: readonly Token[] = [
  t('--radius-sm', 'Badges, tags'),
  t('--radius-md', 'Buttons, inputs'),
  t('--radius-lg', 'Cards'),
  t('--radius-xl', 'Modals, drawers'),
  t('--radius-full', 'Pills, avatars'),
];

export const SHADOW_TOKENS: readonly Token[] = [
  t('--shadow-sm', 'Cards'),
  t('--shadow-md', 'Raised and hovered elements'),
  t('--shadow-lg', 'Menus, popovers'),
  t('--shadow-overlay', 'Modals, drawers'),
];

export const BREAKPOINT_TOKENS: readonly Token[] = [
  t('--breakpoint-sm', '640 px'),
  t('--breakpoint-md', '768 px: touch targets may shrink from here up'),
  t('--breakpoint-lg', '1024 px: the sidebar becomes permanent'),
  t('--breakpoint-xl', '1280 px'),
];

export const SIZE_TOKENS: readonly Token[] = [
  t('--size-touch-target', 'Minimum touch target below md (44 px)'),
  t('--size-control', 'Control height from md up (36 px)'),
];

export const Z_INDEX_TOKENS: readonly Token[] = [
  t('--z-base', 'Normal flow'),
  t('--z-raised', 'Sticky table header and first column'),
  t('--z-sticky', 'Top bar'),
  t('--z-banner', 'Environment banner'),
  t('--z-dropdown', 'Menus, combobox lists, popovers'),
  t('--z-overlay', 'Modal and drawer backdrop'),
  t('--z-modal', 'Modal and drawer'),
  t('--z-toast', 'Toasts'),
  t('--z-tooltip', 'Tooltips'),
];

export const MOTION_TOKENS: readonly Token[] = [
  t('--duration-instant', 'No animation'),
  t('--duration-fast', 'Hover, focus, small state changes'),
  t('--duration-base', 'Menus, tooltips, accordions'),
  t('--duration-slow', 'Drawers, modals'),
  t('--ease-standard', 'Most transitions'),
  t('--ease-enter', 'Elements entering'),
  t('--ease-exit', 'Elements leaving'),
];

/** Every token, in display order. */
export const ALL_TOKENS: readonly Token[] = [
  ...COLOR_GROUPS.flatMap((group) => group.tokens),
  ...FONT_TOKENS,
  ...TEXT_TOKENS,
  ...SPACING_TOKENS,
  ...RADIUS_TOKENS,
  ...SHADOW_TOKENS,
  ...BREAKPOINT_TOKENS,
  ...SIZE_TOKENS,
  ...Z_INDEX_TOKENS,
  ...MOTION_TOKENS,
];

export interface ContrastPair {
  readonly fg: string;
  readonly bg: string;
  /** WCAG AA minimum: 4.5 for text, 3 for UI components and focus indicators. */
  readonly min: 4.5 | 3;
  readonly use: string;
}

const pair = (fg: string, bg: string, min: 4.5 | 3, use: string): ContrastPair => ({ fg, bg, min, use });

/** Every foreground/background combination the interface uses. Each must meet its minimum. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...(['fg', 'fg-muted', 'fg-subtle'] as const).flatMap((fg) =>
    (['canvas', 'surface', 'surface-subtle'] as const).map((bg) =>
      pair(`--color-${fg}`, `--color-${bg}`, 4.5, `${fg} text on ${bg}`),
    ),
  ),
  pair('--color-fg-on-primary', '--color-primary', 4.5, 'Primary button label'),
  pair('--color-fg-on-primary', '--color-primary-hover', 4.5, 'Primary button label, hovered'),
  pair('--color-primary', '--color-surface', 4.5, 'Link on a card'),
  pair('--color-primary', '--color-canvas', 4.5, 'Link on the page'),
  pair('--color-primary-strong', '--color-primary-subtle', 4.5, 'Active nav item, selected row'),
  pair('--color-fg-inverse', '--color-surface-inverse', 4.5, 'Tooltip, environment banner'),
  pair('--color-line-strong', '--color-surface', 3, 'Control border on a card'),
  pair('--color-line-strong', '--color-canvas', 3, 'Control border on the page'),
  pair('--color-focus', '--color-surface', 3, 'Focus ring on a card'),
  pair('--color-focus', '--color-canvas', 3, 'Focus ring on the page'),
  ...FEEDBACK_ROLES.flatMap((role) => [
    pair(`--color-${role}`, '--color-surface', 4.5, `${role} text on a card`),
    pair(`--color-${role}`, `--color-${role}-subtle`, 4.5, `${role} alert text`),
    pair('--color-fg-on-primary', `--color-${role}`, 4.5, `Solid ${role} button label`),
  ]),
  ...DOCUMENT_STATES.flatMap((state) => [
    pair(`--color-state-${state}`, `--color-state-${state}-subtle`, 4.5, `${state} badge`),
    pair(`--color-state-${state}`, '--color-surface', 4.5, `${state} text on a card`),
  ]),
];
