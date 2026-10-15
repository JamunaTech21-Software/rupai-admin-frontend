import { type ReactNode } from 'react';

import { useFormat, useTranslation } from '@/lib/i18n';
import { type FieldBinding } from '@/lib/forms';
import { Dec } from '@/lib/money';
import { Card } from '@/ui';

import { useEstateSummary } from '../api/estateProfile';
import { AreaInput } from './AreaInput';

/** One figure that is worked out, never typed: its name above, its value in a read-only box. */
function Figure({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <dl className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-sm font-medium text-fg">{label}</dt>
      <dd className="flex min-h-10 items-center rounded-md border border-line bg-surface-subtle px-3 text-fg figures">
        {value}
      </dd>
    </dl>
  );
}

/**
 * Estate Overview (R.2), two rows of four as in the design. Total land area is typed here (it is the estate's declared
 * area and saves with the form); the rest is worked out and cannot be typed. Non-tea area follows what is typed, as
 * it is typed (total minus tea area, never below zero); tea area, fields, divisions and sections come from the
 * estate's records (GET /estates/{id}/summary) and workers and families from HR (Phase 2).
 */
export function EstateOverview({
  estateId,
  totalArea,
  isReadOnly,
}: {
  /** Empty for an estate not yet saved: it has no records to count. */
  readonly estateId: string;
  readonly totalArea: FieldBinding<string | null>;
  readonly isReadOnly: boolean;
}) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const summary = useEstateSummary(estateId);
  const s = summary.data;
  const isNew = estateId === '';
  const unknown = <span className="text-fg-muted">{summary.isError ? '—' : '…'}</span>;

  const count = (value: number | undefined) => {
    if (isNew) return format.number(0);
    return value === undefined ? unknown : format.number(value);
  };
  const workforce = (value: number | undefined) =>
    s && !s.workforce_available ? <span className="text-fg-muted">{t('profile.withHr')}</span> : count(value);

  const typed = totalArea.value;
  const teaArea = isNew ? '0' : s?.tea_area;
  const nonTea = (() => {
    if (typed === null || typed.trim() === '' || teaArea === undefined) return null;
    try {
      const rest = new Dec(typed).minus(teaArea);
      return rest.isNegative() ? '0' : rest.toFixed(3);
    } catch {
      return null;
    }
  })();

  return (
    <Card title={t('profile.overview')} headingLevel={2}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col">
          <AreaInput
            label={t('profile.overviewFields.totalArea')}
            placeholder="0.00"
            isReadOnly={isReadOnly}
            {...totalArea}
          />
        </div>
        <Figure
          label={t('profile.overviewFields.teaArea')}
          value={teaArea === undefined ? unknown : format.decimal(teaArea, 2)}
        />
        <Figure
          label={t('profile.overviewFields.nonTeaArea')}
          value={
            nonTea === null ? (
              <span className="text-fg-muted">{t('profile.notDeclared')}</span>
            ) : (
              format.decimal(nonTea, 2)
            )
          }
        />
        <Figure label={t('profile.overviewFields.fields')} value={count(s?.field_count)} />
        <Figure label={t('profile.overviewFields.divisions')} value={count(s?.division_count)} />
        <Figure label={t('profile.overviewFields.sections')} value={count(s?.section_count)} />
        <Figure label={t('profile.overviewFields.workers')} value={workforce(s?.worker_count)} />
        <Figure label={t('profile.overviewFields.families')} value={workforce(s?.family_count)} />
      </div>
    </Card>
  );
}
