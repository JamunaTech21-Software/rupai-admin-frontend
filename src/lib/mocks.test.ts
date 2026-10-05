import { describe, expect, it } from 'vitest';

import { describeMockSetting, isFeatureMocked, parseMockSetting } from './mocks';

describe('VITE_MOCK_API', () => {
  it('mocks nothing by default', () => {
    for (const raw of [undefined, '', ' none ', 'false', 'off', ',']) {
      expect(parseMockSetting(raw)).toEqual({ kind: 'none' });
    }
  });

  it('mocks everything with "all"', () => {
    const setting = parseMockSetting('ALL');
    expect(setting).toEqual({ kind: 'all' });
    expect(isFeatureMocked(setting, 'users')).toBe(true);
  });

  it('mocks only the listed features', () => {
    const setting = parseMockSetting(' users, Payroll ,,');
    expect(isFeatureMocked(setting, 'users')).toBe(true);
    expect(isFeatureMocked(setting, 'payroll')).toBe(true);
    expect(isFeatureMocked(setting, 'system')).toBe(false);
    expect(describeMockSetting(setting)).toBe('users, payroll');
  });

  it('describes none and all', () => {
    expect(describeMockSetting({ kind: 'none' })).toBe('none');
    expect(describeMockSetting({ kind: 'all' })).toBe('all');
  });
});
