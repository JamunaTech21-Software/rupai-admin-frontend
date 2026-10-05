/**
 * The per-feature mock switch (P0.08, RUP-405). `VITE_MOCK_API` decides which features answer from MSW mocks
 * instead of the real backend:
 *
 *   VITE_MOCK_API=none            every request goes to the backend (the default)
 *   VITE_MOCK_API=all             every feature that has mocks uses them
 *   VITE_MOCK_API=users,payroll   only these features are mocked; everything else goes to the backend
 *
 * Mocks follow the API contract (Spec P4) and are switched off feature by feature as each [BE] story lands.
 * They run in development only: a production or staging build never mocks.
 */
export type MockSetting =
  | { readonly kind: 'none' }
  | { readonly kind: 'all' }
  | { readonly kind: 'some'; readonly features: ReadonlySet<string> };

export function parseMockSetting(raw: string | undefined): MockSetting {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === 'none' || value === 'false' || value === 'off') return { kind: 'none' };
  if (value === 'all' || value === 'true') return { kind: 'all' };
  const features = new Set(
    value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return features.size === 0 ? { kind: 'none' } : { kind: 'some', features };
}

export function isFeatureMocked(setting: MockSetting, feature: string): boolean {
  if (setting.kind === 'all') return true;
  if (setting.kind === 'none') return false;
  return setting.features.has(feature);
}

/** The setting for this build. Always "none" outside development. */
export const mockSetting: MockSetting = import.meta.env.DEV
  ? parseMockSetting(import.meta.env.VITE_MOCK_API)
  : { kind: 'none' };

/** For display: "none", "all", or the list of mocked features. */
export function describeMockSetting(setting: MockSetting): string {
  if (setting.kind === 'some') return [...setting.features].join(', ');
  return setting.kind;
}
