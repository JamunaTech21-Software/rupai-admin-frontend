# lib

Framework-level helpers shared by every feature. `lib/` never imports from `features/` or `app/`.

| Module        | Delivered in | Purpose                                                                                                                                           |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`      | F0.01        | Validated browser configuration (`VITE_API_BASE_URL`)                                                                                             |
| `api/`        | F0.06        | The one API client: envelopes, typed errors, in-memory token, one shared refresh, If-Match, Idempotency-Key, error → behaviour                    |
| `query/`      | F0.06        | TanStack Query client, cache policy table, key factories, mutations with invalidation sets and the conflict dialog, URL-driven list hooks, useJob |
| `mocking/`    | F0.06        | MSW helpers following the API contract (envelopes, list grammar, If-Match, errors) and demo auth/job mocks                                        |
| `urlState.ts` | F0.05        | Tabs, pages and table sort/filters in the URL, in the API's list grammar                                                                          |
| `auth/`       | F0.07        | AuthProvider, `<Can>`, `usePermission()`                                                                                                          |
| `money/`      | F0.04        | Decimal-string money and quantities (decimal.js), never floats                                                                                    |
| `dates/`      | F0.04        | Business dates with no timezone drift                                                                                                             |
| `i18n/`       | F0.07        | react-i18next setup and locale-aware formatting                                                                                                   |
