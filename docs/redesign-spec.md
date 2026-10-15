# RupAi redesign: design spec (R.1–R.5)

The manager's prototype (`../rupai-backend-dashboard`) is the visual reference. It is plain JavaScript with dummy
data and uses its styles inconsistently (gray and slate, labels from 10 to 14 px). This page fixes **one value per
decision**, so nobody has to re-read the prototype's 63,000 lines. Look up a prototype file only for the layout of
the one screen being built, and search it rather than reading it whole.

Everything here is a token in `src/ui/styles/tokens.css` or a style in a `src/ui` component. Screens never use
raw colours or pixel sizes.

## 1. Colour

| Role (token)                                | Value     | Prototype                                |
| ------------------------------------------- | --------- | ---------------------------------------- |
| `primary`                                   | `#1b5e4b` | `--color-primary`                        |
| `primary-hover` / `primary-strong`          | `#134438` | `--color-primary-dark`                   |
| `focus`                                     | `#2a7a62` | `--color-primary-light`                  |
| `primary-subtle` (hover and selection tint) | `#e8f5f0` | `--color-primary-muted`                  |
| `canvas` (page)                             | `#f8fafc` | body background                          |
| `surface`                                   | `#ffffff` | cards, sidebar, header                   |
| `surface-subtle` (table headers, read-only) | `#f1f5f9` | `bg-slate-50` / `bg-gray-50`             |
| `fg` (body text)                            | `#334155` | body `color` (slate-700)                 |
| `fg-strong` (headings, names)               | `#1e293b` | `text-slate-800`                         |
| `fg-muted`                                  | `#475569` | `text-slate-500/600`                     |
| `fg-subtle` (hints, section labels)         | `#5b6678` | `text-slate-400`, darkened for contrast  |
| `heading` (card titles)                     | `#166534` | `text-green-800`                         |
| `card-header` (card title bar)              | `#f0fdf4` | `bg-green-50`                            |
| `line`                                      | `#e2e8f0` | `border-slate-200`                       |
| `line-strong` (input borders)               | `#7c8799` | `border-gray-300`, darkened for contrast |

The prototype's `green-700` / `emerald-700` buttons and links use `primary`, as the Jira tokens say.

## 2. Type (Inter, Tailwind's scale)

| Token                             | Size                                      | Used for                                                                  |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `text-2xs`                        | 10 px, uppercase, semibold, wide tracking | sidebar section labels                                                    |
| `text-xs`                         | 12 px                                     | sidebar sub-items, captions, badges                                       |
| `text-nav`                        | 13 px, medium                             | sidebar items                                                             |
| `text-sm`                         | 14 px                                     | form labels (medium), table cells, buttons, secondary text                |
| `text-base`                       | 16 px                                     | body, inputs                                                              |
| `text-lg`                         | 18 px, semibold                           | card titles (`heading` colour), the header's page title (bold, `primary`) |
| `text-xl` / `2xl` / `3xl` / `4xl` | 20 / 24 / 30 / 36 px                      | section and page titles, dashboard figures                                |

## 3. Shape and spacing

- Radii: inputs and buttons `rounded-md` = 8 px; cards `rounded-lg` = 12 px; modals and menus `rounded-xl` = 12 px.
- Cards: white, `shadow-sm`, 1 px `line` border, 12 px radius. The header is a `card-header` bar with a bottom
  border, padding 16 px × 24 px (16 px on phones), and the title in `text-lg` semibold `heading`. The body has
  16–24 px padding.
- Controls: 44 px high on phones, 40 px from md (the prototype's `h-10`/`h-11`).
- Buttons: primary is solid `primary` with white text; secondary has a `primary-subtle` background, a `primary`
  border and `primary-strong` text; ghost is text only. Font is `text-sm` semibold.
- Tables: header row `surface-subtle` in `text-sm` semibold `fg-muted`; cells `text-sm`, 12 px × 10 px.
- Main area padding: 12 px on phones, 16 px from sm.

## 4. Shell

- **Sidebar** (white, right border; 270 px wide, a 72 px icon rail when collapsed on desktop, a drawer
  `min(270px, 85vw)` below lg):
  - Top: logo, "RupAi ERP" bold `primary`, tagline `text-2xs` `fg-subtle`.
  - Section label: `text-2xs` uppercase `fg-subtle`. Item: `text-nav` medium `fg-muted`, 16 px icon in
    `fg-subtle`; hover is `primary-subtle` background with `primary` text. The **current item is solid `primary`
    with white text and icon**, plus `shadow-sm`.
  - Group: a chevron that turns 90° when open. Sub-items in `text-xs` sit on a left rule; the current sub-item
    is `primary-subtle` with `primary` text. One group open at a time, and the group holding the current page
    opens by itself.
  - Bottom: a `primary` card, 12 px radius, with a leaf icon, "RupAi ERP" and "Version x.y.z".
- **Header** (white, bottom border, 56 px; 64 px from sm): menu toggle, page title (`text-lg` bold `primary`),
  then the estate switcher, today's date (xl and up, in a `canvas` pill), running jobs, notifications, and the
  user (avatar with a `primary` ring, then name and role from sm).

## 5. Sidebar grouping (only what exists; future modules stay hidden)

| Section          | Group → items                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (none)           | Dashboard                                                                                                                                                            |
| (none)           | **Estate Management** → Estates, Fields, Factories, Warehouses, Parties (land & lease)                                                                               |
| Master Data      | **Master Data** → All masters, Units of measure, Tea grades, Seasons                                                                                                 |
| Sales & Accounts | **Accounts & Finance** → Fiscal years, Accounting periods                                                                                                            |
| System settings  | **User Administration** → Users, Roles & permissions, Access review, Audit log; **Configuration** → Organisation, Document numbering, System settings, Design tokens |

The design calls the second group "System Settings"; it is "Configuration" here, because one of its pages is already called System settings. Plantation, HR & Workforce, Production and Reports are added as their modules arrive. Each item keeps its
permission; a group with no visible items disappears.

## 6. Deliberate differences from the prototype (accessibility, WCAG AA)

- Section labels and hints use `fg-subtle` `#5b6678` (5.9:1) instead of slate-400 (2.6:1).
- Input borders use `line-strong` (3:1) instead of gray-300 (1.5:1).
- Table text stays 14 px; the prototype's 10–11 px cells are too small to read.
- Controls are 44 px on phones (touch target).
- Areas are shown and entered in **acres** everywhere (decision of 2026-10-14; R.2 converts the backend).
