import { usePermission, usePermissionCheck } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { useActiveLookups } from '@/lib/lookups';
import { Card, Link, PageHeader, Stack } from '@/ui';

import { MASTER_GROUPS, MASTER_TYPES, type MasterType } from '../masters';

/** How many active rows a master has, from the lists loaded at sign-in. Countries load on demand: no count. */
function ActiveCount({ type }: { readonly type: MasterType }) {
  const { t } = useTranslation('ref');
  const format = useFormat();
  const canRead = usePermission('lookup.view');
  const rows = useActiveLookups(type.key, canRead && type.key !== 'country');
  if (!rows.data) return null;
  return (
    <span className="shrink-0 text-sm whitespace-nowrap text-fg-muted">
      {t('index.active', { count: rows.data.length, formatted: format.number(rows.data.length) })}
    </span>
  );
}

/**
 * Reference data (P1.10): every master the user may see, grouped by what it is used for. Each opens the same
 * kind of list; units and tea grades have pages of their own.
 */
export function MastersPage() {
  const { t } = useTranslation('ref');
  const can = usePermissionCheck();
  const groups = MASTER_GROUPS.map((group) => ({
    group,
    types: MASTER_TYPES.filter((type) => type.group === group && can(`${type.permission}.view`)),
  })).filter(({ types }) => types.length > 0);

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {groups.map(({ group, types }) => (
          <Card key={group} title={t(`groups.${group}`)} headingLevel={2}>
            <ul className="flex flex-col divide-y divide-line">
              {types.map((type) => (
                <li
                  key={type.key}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link href={type.href} className="font-medium">
                      {t(`types.${type.key}.title`)}
                    </Link>
                    <span className="text-sm text-fg-muted">{t(`types.${type.key}.about`)}</span>
                  </span>
                  <ActiveCount type={type} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Stack>
  );
}

export { MastersPage as Component };
