# RupAI Frontend

The web app for **RupAI**, an integrated ERP for tea estates.
**React 19 · TypeScript (strict) · Vite · React Router (data router) · Tailwind CSS**

- Backend: `../backend` (REST API at `/api/v1`, docs at `http://localhost:4000/docs`)
- Jira project: `RUP`, frontend phase **F0** (this scaffold is F0.01, RUP-342)
- Visual reference: `../rupai-backend-dashboard` (the earlier dashboard prototype)

## Requirements

- **Node.js 24 LTS.** The version is pinned in `.nvmrc`; run `nvm use`.
- **npm 10 or later**
- For end-to-end tests only: the Playwright browser, installed once with `npx playwright install chromium`,
  or use an installed browser instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` (or `msedge`)

## Quick start

```bash
nvm use            # Node 24
npm install
npm run dev        # http://localhost:5173
```

Copy `.env.example` to `.env.local` only if you need to change a default.

## Run against the backend

You run the backend on your own machine; the full guide is `../backend/docs/FRONTEND_SETUP.md`. In short:

```bash
cd ../backend
cp .env.example .env       # first time only
npm ci
npm run stack:up           # MySQL, Redis, Mailpit in Docker (Docker Desktop must be running)
npm run db:migrate:deploy
npm run db:seed            # permissions, Administrator role, bootstrap admin
npm run db:seed:demo       # optional: demo accounts `manager` and `viewer`
npm run dev                # API on http://localhost:4000
```

The Vite dev server proxies `/api`, `/health` and `/docs` to `VITE_API_PROXY_TARGET` (default
`http://localhost:4000`), so the browser talks to one origin.

- **Always call the relative `/api/v1/...`**, never `http://localhost:4000` directly. The refresh token is an
  `HttpOnly` cookie and works only same-origin.
- Check: http://localhost:5173/health/ready answers `{"data":{"status":"ready",…}}`; the API docs are at
  http://localhost:5173/docs.
- **Accounts:** `admin` (`BOOTSTRAP_ADMIN_PASSWORD` in the backend `.env`, must change it at first sign-in);
  `manager` and `viewer` (`DEMO_PASSWORD`, after `db:seed:demo`).
- Password-reset emails land in Mailpit: http://localhost:8025.
- **When the backend gets a new feature:** `git pull`, `npm ci`, `npm run db:migrate:deploy`, `npm run db:seed`,
  restart `npm run dev`. Then switch that feature's mocks off.
- Every page shows an **environment banner** outside production, from the backend's `X-Environment` header.

### Mocks per feature (`VITE_MOCK_API`)

Until a feature's backend exists, its screens can answer from MSW mocks that follow the API contract. Set
`VITE_MOCK_API` in `.env.local`:

| Value          | Effect                                                               |
| -------------- | -------------------------------------------------------------------- |
| `none`         | Default. Every request goes to the backend                           |
| `all`          | Every feature that has mocks uses them                               |
| `system,users` | Only these features are mocked; all other requests reach the backend |

Mocks run in development only (a production or staging build never mocks, and contains no MSW code). The home
page shows the current setting. To give a feature mocks: write `src/features/<name>/api/mocks.ts` exporting
`handlers`, export a `load<Name>Mocks = () => import('./api/mocks')` from the feature's index, and add it to
`FEATURE_MOCKS` in `src/app/mocks.ts`. Switch it off once the feature's `[BE]` story is Done.

## Staging (Vercel)

The web app is deployed to **Vercel** from GitHub; the backend runs on the staging machine behind a Cloudflare
tunnel (`../backend/docs/STAGING.md`). `vercel.json` rewrites `/api/*`, `/health*` and `/docs*` to the staging API
and sends every other path to `index.html` (SPA fallback), so the browser sees one origin and the sign-in cookie
works.

1. **Import the repository in Vercel** (Add New → Project). Vercel detects Vite; `vercel.json` sets the install
   (`npm ci`), build (`npm run build`) and output (`dist`). Do **not** set `VITE_API_BASE_URL`.
2. Every push to the main branch redeploys; pull requests get preview URLs that reach the same staging API.
3. **Send the Vercel URL to the backend developer**: it becomes `APP_PUBLIC_URL` (password-reset links).
4. **The staging API address is temporary** (a Cloudflare quick tunnel) until a domain is added. When the backend
   developer posts a new address on RUP-403, replace the hostname in all five rewrite destinations in
   `vercel.json` and push.

Check after a deploy: `https://<project>.vercel.app/health/ready` is `ready`, the staging banner shows, and you can
sign in as `manager` or `viewer` (password from the backend developer).

## Scripts

| Script                            | What it does                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server with hot reload and the API proxy                                 |
| `npm run build`                   | Type-checks, then builds to `dist/` (with a manifest and source maps)             |
| `npm run preview`                 | Serves the production build locally                                               |
| `npm run typecheck`               | Type-checks the app and the Node-side config without emitting files               |
| `npm run lint` / `lint:fix`       | ESLint: strict type-checked rules, React hooks, import boundaries, money rules    |
| `npm run format` / `format:check` | Prettier (with Tailwind class sorting)                                            |
| `npm test` / `test:watch`         | Vitest + React Testing Library + MSW + axe, in jsdom                              |
| `npm run test:coverage`           | Unit tests with V8 coverage                                                       |
| `npm run test:e2e`                | Playwright end-to-end tests, including axe accessibility checks in a real browser |
| `npm run storybook`               | The component workspace at http://localhost:6610                                  |
| `npm run build-storybook`         | Builds the workspace to `storybook-static/`                                       |
| `npm run test:storybook`          | Builds the workspace, then runs axe on every story in a real browser              |
| `npm run size`                    | Bundle-size budget check on `dist/` (run after `build`)                           |
| `npm run check`                   | Typecheck, lint, format check and unit tests (a quick pre-push check)             |
| `npm run ci`                      | `check`, then build and the bundle-size budget                                    |

## Project layout (Spec P5 §3.1)

```
src/
  app/                    Composition root: entry (main.tsx), route tree, layouts, global CSS
  ui/                     Design tokens (styles/, tokens.ts) and the component library (F0.03–F0.05)
  lib/                    api, query client, auth, money, dates, i18n (env.ts today)
  features/<module>/
    api/                  Data access for the feature (hooks over the API client)
    components/           Components used only by this feature
    pages/                Route components, loaded lazily (one chunk per page)
    types.ts              The feature's types
    index.ts              The feature's published API (its routes and anything others may use)
  types/                  Types shared across features (DecimalString, BusinessDate, Id)
tests/                    Test setup, MSW server and handlers, the axe helper
e2e/                      Playwright tests
eslint-rules/             Project-local ESLint rules (import boundaries)
scripts/                  Build tooling (bundle-size budget)
```

### Import boundaries (enforced by `npm run lint`)

| From         | May not import                                                               |
| ------------ | ---------------------------------------------------------------------------- |
| `ui/`        | `features/`, `app/`                                                          |
| `lib/`       | `features/`, `app/`                                                          |
| `types/`     | `features/`, `app/`, `ui/`, `lib/`                                           |
| `features/*` | `app/`, and another feature's internals: use `@/features/<name>` (its index) |

Page components (`features/*/pages/**`) may not call `fetch`, `XMLHttpRequest` or the API client directly. Data
comes through the feature's `api/` hooks.

### Money and quantities

`parseFloat`, `Number.parseFloat` and `Number(...)` are lint errors: money and quantities travel as decimal
strings and are handled by the decimal helpers (F0.04, F0.06). A genuine non-money use needs an
`eslint-disable-next-line` comment that says why.

## Design tokens (F0.02)

All visual values live in `src/ui/styles/tokens.css` as CSS custom properties on `:root`, and each one is also a
Tailwind utility. The live reference is at **http://localhost:5173/design/tokens**: every token, its value, its use,
and every contrast pair measured in the browser.

- **Colours are named by role, never appearance.** Tailwind's default palette is switched off: use `bg-canvas`,
  `bg-surface`, `text-fg`, `text-fg-muted`, `border-line`, `bg-primary`, `text-danger`,
  `bg-state-approved-subtle` and so on. `tests/role-colours.test.ts` fails on `bg-slate-50`-style classes and
  hard-coded colours.
- **Colour never carries meaning on its own:** a state or feedback colour always comes with its label.
- **Contrast:** every pair in `CONTRAST_PAIRS` (`src/ui/tokens.ts`) meets WCAG AA (4.5:1 text, 3:1 borders and
  focus). `src/ui/tokens.test.ts` checks the values; the Playwright run checks the rendered page with axe.
- **Type scale:** ratio 1.200 from 16 px (`text-xs` … `text-4xl`). Body text is `text-base` (16 px), never smaller.
- **Fonts:** Inter for Latin and Noto Sans Bengali for Bengali names, self-hosted through Fontsource (no font
  server). Put `figures` on every money and quantity cell for tabular digits.
- **Spacing** is a 4 px grid (`p-1` = 4 px). **Radii** `rounded-sm|md|lg|xl|full`, **shadows**
  `shadow-sm|md|lg|overlay`.
- **Breakpoints, mobile-first:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Below `md`, buttons and inputs are at
  least 44 px tall (`--size-touch-target`).
- **Layers and motion:** `z-(--z-modal)`, `duration-(--duration-fast)` and so on; never a bare z-index or duration.
  Durations collapse to 0 under `prefers-reduced-motion`.

The palette is a placeholder taken from the RupAI dashboard until the designer delivers it (open item O-23). To
change a colour, change it in `tokens.css` only, and keep `npm test` green.

## Component library (F0.03)

`src/ui` is the component library, built on **React Aria Components** (decision O-22) and styled with the tokens.
Import everything from `@/ui`; lint stops features from importing `react-aria-components` or `lucide-react`.

Primitives: `Button`, `IconButton`, `Link`, `Badge`, `Tag`, `Avatar`, `Icon` (the icon set), `Spinner`, `Skeleton`
(text, block, table-row), `Divider`, plus `VisuallyHidden`, `announce()` (screen-reader live regions) and
`UiProvider` (connects ui Links to the router).

**The workspace** (`npm run storybook`, http://localhost:6610) shows every component in every state that applies
(default, hover, focus, disabled, error, loading, empty), with props generated from the types, usage rules, and an
axe Accessibility panel. _Introduction_ documents the accessibility baseline; _Foundations / Design tokens_ is the
token reference.

Each component meets the baseline: keyboard operable with a visible focus ring, correct roles and names, focus
trapping and restore for overlays (F0.05), live-region announcements, and reduced motion respected. It is checked
three ways:

- `npm test` renders every story, runs its keyboard `play` function, and runs axe on it.
- `src/ui/primitives.test.tsx` covers each primitive's behaviour (Enter/Space, pending, disabled, names).
- `npm run test:storybook` runs axe on every story in Chrome, including colour contrast.

To add a component: write it in `src/ui`, export it from `src/ui/index.ts`, add `<Name>.stories.tsx` with its usage
rules in `parameters.docs.description.component` and a story per state. The story tests pick it up automatically.

## Forms (F0.04)

**Controls** (all in `@/ui`, all with `label`, `hint`, `error`, `isRequired`, `isDisabled`, `value` / `onChange`):
`Input`, `Textarea`, `Select`, `MultiSelect`, `AsyncCombobox` (debounced, paginated server search),
`Checkbox` (with indeterminate), `CheckboxGroup`, `RadioGroup`, `Switch`, `TimeInput`, `FileUpload` (type and size
checks, progress), and `FormField` for anything custom.

**Domain inputs** — never swap them for generic controls:

| Input                            | Value                   | Notes                                                                |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `MoneyInput`                     | decimal string          | `"12345.6700"` round-trips; shows `12,345.67`; `scale={4}` for rates |
| `QuantityInput`                  | decimal string          | kg, 3 places, unit shown after the value                             |
| `NumberInput`                    | number                  | counts only, never money or quantities                               |
| `DatePicker` / `DateRangePicker` | `YYYY-MM-DD` (business) | typed or picked, presets, no timezone conversion, so no day shift    |
| `TimeInput`                      | `HH:mm`                 | 24-hour by default                                                   |

**Building a form** (`@/lib/forms`):

```tsx
const form = useZodForm(schema); // validates on touch, focuses the first error on submit
<MoneyInput label="Rate per kg" scale={4} {...useFormField(form.control, 'rate')} />;
// On a 422 from the API: put each detail on its field (lines.1.quantity → line 2) and focus the first.
const formLevel = applyServerErrors(form, error.details);
```

Schemas: `zMoney`, `zQuantity`, `zDecimalString(kind)`, `zBusinessDate`, `zTimeOfDay` mirror the backend's rules and
keep values as strings. Decimal maths goes through `@/lib/money` (`Dec`, `formatDecimal`, `toApiDecimal`,
`roundMoney`); lint stops anything else importing `decimal.js`. Business dates go through `@/lib/dates`.

See _Forms / Form example_ in Storybook for a complete form with line items and server errors.

## Configuration

Only `VITE_*` variables reach the browser, so none of them may hold a secret. `src/lib/env.ts` validates them at
start-up.

| Variable                | Default                 | Used by                                          |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| `VITE_API_BASE_URL`     | `/api/v1`               | The API client: a same-origin path or a full URL |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | The dev server proxy only                        |
| `VITE_MOCK_API`         | `none`                  | Which features use MSW mocks (development only)  |

Keep `VITE_API_BASE_URL` at `/api/v1` everywhere, including staging: the refresh-token cookie works only
same-origin.

## Bundle-size budget

Initial JavaScript under **250 KB** gzipped and each route chunk under **80 KB** gzipped. Every page is a lazy
route (`lazy: () => import('./pages/…')` in the feature's `index.ts`), so it lands in its own chunk.
`npm run build && npm run size` prints each chunk against its budget and fails if one is over.

## Testing

- **Unit and component tests** live next to the code (`*.test.ts(x)`). MSW intercepts every request; an
  unmocked request fails the test. Add per-test handlers with `server.use(...)`.
- **Accessibility:** `axeViolations(container)` from `tests/axe.ts` in component tests, and `@axe-core/playwright`
  in `e2e/` (which also checks colour contrast in a real browser).

## Commit conventions

Same as the backend: [Conventional Commits](https://www.conventionalcommits.org/) with the Jira key, for example

```
feat(ui): add the Button primitive (RUP-361)
```

The Husky hooks (`lint-staged` on pre-commit, `commitlint` on commit-msg) are set up by `npm install` once this
folder is inside a git repository. If the git root is the parent `RupAI/` folder rather than `frontend/`, change
`prepare` to `cd .. && husky frontend/.husky`.
