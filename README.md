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

The dev server proxies `/api` and `/health` to `VITE_API_PROXY_TARGET` (default `http://localhost:4000`), so the
browser talks to one origin and CORS never comes into play. Start the backend first (see `../backend/README.md`):

```bash
cd ../backend
npm run stack:up && npm run db:migrate:deploy && npm run db:seed && npm run dev
```

Then `http://localhost:5173/health/ready` should answer `{"data":{"status":"ready",…}}` through the proxy.

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
| `npm run size`                    | Bundle-size budget check on `dist/` (run after `build`)                           |
| `npm run check`                   | Typecheck, lint, format check and unit tests (a quick pre-push check)             |
| `npm run ci`                      | `check`, then build and the bundle-size budget                                    |

## Project layout (Spec P5 §3.1)

```
src/
  app/                    Composition root: entry (main.tsx), route tree, layouts, global CSS
  ui/                     The component library (F0.03–F0.05)
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

## Configuration

Only `VITE_*` variables reach the browser, so none of them may hold a secret. `src/lib/env.ts` validates them at
start-up.

| Variable                | Default                 | Used by                                          |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| `VITE_API_BASE_URL`     | `/api/v1`               | The API client: a same-origin path or a full URL |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | The dev server proxy only                        |

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
