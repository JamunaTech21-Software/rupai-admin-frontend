import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildNavigation, titleFor } from '@/app/navigation';
import { safeReturnTo, loginPathFor } from '@/features/auth';
import { Can, hasPermission } from '@/lib/auth';
import { AuthContext, type AuthContextValue } from '@/lib/auth/me';
import { i18n, makeFormatters, toLocalDigits } from '@/lib/i18n';
import { bn } from '@/lib/i18n/locales/bn';
import { en } from '@/lib/i18n/locales/en';

describe('formatting per language', () => {
  const english = makeFormatters('en');
  const bangla = makeFormatters('bn');

  it('formats money from decimal strings, never floats', () => {
    expect(english.money('1234567.5')).toBe('৳1,234,567.50');
    expect(bangla.money('1234567.5')).toBe('৳১২,৩৪,৫৬৭.৫০');
    expect(english.money('-12.345')).toBe('-৳12.345');
    expect(english.decimal('12345.6700')).toBe('12,345.67');
  });

  it('formats quantities to the gram, and counts', () => {
    expect(english.quantity('41.25')).toBe('41.250 kg');
    expect(english.number(1240)).toBe('1,240');
    expect(bangla.number(1240)).toBe('১,২৪০');
    expect(toLocalDigits('2026-10-04', 'bn')).toBe('২০২৬-১০-০৪');
  });

  it('formats business dates without drift and instants in Dhaka', () => {
    expect(english.date('2026-10-04')).toBe('4 Oct 2026');
    expect(english.dateTime('2026-10-04T19:30:00Z')).toBe('5 Oct 2026, 01:30');
    expect(bangla.date('2026-10-04')).toMatch(/২০২৬/);
  });
});

describe('locales', () => {
  function keys(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }

  it('Bangla has exactly the English keys, none left empty', () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
    const empty = keys(bn).filter((key) => {
      const value = key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], bn);
      return value === '' && !key.startsWith('nav.sections.main');
    });
    expect(empty).toEqual([]);
  });

  it('interpolates and switches language', async () => {
    expect(i18n.t('home:welcome', { name: 'Rina' })).toBe('Welcome, Rina');
    await i18n.changeLanguage('bn');
    expect(i18n.t('home:welcome', { name: 'Rina' })).toBe('স্বাগতম, Rina');
    await i18n.changeLanguage('en');
  });
});

describe('return URL after sign-in', () => {
  it.each([
    ['/admin/users?tab=active', '/admin/users?tab=active'],
    [null, '/'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['/login?returnTo=/x', '/'],
  ])('%s → %s', (raw, expected) => {
    expect(safeReturnTo(raw)).toBe(expected);
  });

  it('builds the sign-in path', () => {
    expect(loginPathFor('/')).toBe('/login');
    expect(loginPathFor('/admin/users?x=1')).toBe('/login?returnTo=%2Fadmin%2Fusers%3Fx%3D1');
  });
});

function withPermissions(permissions: string[], node: React.ReactNode) {
  const value: AuthContextValue = {
    state: {
      status: 'signed-in',
      me: {
        user: { id: '1', username: 'u', status: 'active', roles: [] },
        permissions,
        scope: {},
        session_id: null,
        must_change_password: false,
      },
    },
    signIn: () => Promise.reject(new Error('unused')),
    signOut: () => Promise.resolve(),
    signOutEverywhere: () => Promise.resolve(),
    reload: () => Promise.resolve(),
  };
  return <AuthContext.Provider value={value}>{node}</AuthContext.Provider>;
}

describe('permissions', () => {
  it('Can shows children only with every listed permission', () => {
    render(
      withPermissions(
        ['user.view'],
        <>
          <Can permission="user.view">
            <p>can view</p>
          </Can>
          <Can permission={['user.view', 'user.edit']} fallback={<p>read only</p>}>
            <p>can edit</p>
          </Can>
        </>,
      ),
    );
    expect(screen.getByText('can view')).toBeInTheDocument();
    expect(screen.queryByText('can edit')).not.toBeInTheDocument();
    expect(screen.getByText('read only')).toBeInTheDocument();
  });

  it('`*` grants everything; nothing is granted without a session', () => {
    expect(hasPermission(['*'], 'audit.export')).toBe(true);
    expect(hasPermission(undefined, 'user.view')).toBe(false);
  });

  it('the sidebar keeps only permitted entries and drops empty sections', () => {
    const t = ((key: string) => key) as never;
    const viewer = buildNavigation(t, (p) => p === undefined);
    expect(viewer.map((s) => s.id)).toEqual(['main', 'system']);
    const admin = buildNavigation(t, () => true);
    expect(admin.find((s) => s.id === 'administration')?.items.map((i) => i.id)).toEqual([
      'users',
      'roles',
      'audit',
    ]);
    expect(titleFor(admin, '/admin/users/42')).toBe('users');
    expect(titleFor(admin, '/')).toBe('dashboard');
  });
});
