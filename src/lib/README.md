# lib

Framework-level helpers shared by every feature. `lib/` never imports from `features/` or `app/`.

| Module   | Delivered in | Purpose                                                                                |
| -------- | ------------ | -------------------------------------------------------------------------------------- |
| `env.ts` | F0.01        | Validated browser configuration (`VITE_API_BASE_URL`)                                  |
| `api/`   | F0.06        | The one API client: envelopes, typed errors, refresh-on-401, If-Match, Idempotency-Key |
| `query/` | F0.06        | TanStack Query client, cache policy, query-key factories                               |
| `auth/`  | F0.07        | AuthProvider, `<Can>`, `usePermission()`                                               |
| `money/` | F0.04        | Decimal-string money and quantities (decimal.js), never floats                         |
| `dates/` | F0.04        | Business dates with no timezone drift                                                  |
| `i18n/`  | F0.07        | react-i18next setup and locale-aware formatting                                        |
