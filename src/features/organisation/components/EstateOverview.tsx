import { useFormat, useTranslation } from '@/lib/i18n';
import { type FieldBinding } from '@/lib/forms';
import { Dec } from '@/lib/money';
import { Card, NumberInput } from '@/ui';

import { useEstateSummary } from '../api/estateProfile';
import { AreaInput } from './AreaInput';

type CountField = 'field_count' | 'division_count' | 'section_count' | 'worker_count' | 'family_count';

export interface OverviewBindings extends Record<CountField, FieldBinding<number | null>> {
  readonly total_area: FieldBinding<string | null>;
  readonly tea_area: FieldBinding<string | null>;
  readonly non_tea_area: FieldBinding<string | null>;
}

const isEntered = (value: string | null): value is string => value !== null && value.trim() !== '';

/**
 * Estate Overview (R.2), two rows of four as in the design, every figure an input saved with the profile. Leave a
 * figure empty and the computed one is shown (and says "Auto"); type one and that is what the estate carries, with
 * "Records: n" beside it when the records say something else. Clearing it goes back to the computed figure. Non-tea
 * area follows total minus tea area, live, until it is typed; tea area, fields, divisions and sections are computed
 * from the estate's records (GET /estates/{id}/summary) and workers and families from HR (Phase 2).
 */
export function EstateOverview({
  estateId,
  bind,
  isReadOnly,
}: {
  /** Empty for an estate not yet saved: it has no records to count. */
  readonly estateId: string;
  readonly bind: OverviewBindings;
  readonly isReadOnly: boolean;
}) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const summary = useEstateSummary(estateId);
  const records = summary.data?.computed;
  const isNew = estateId === '';

  const areaText = (value: string | null | undefined) =>
    value === null || value === undefined ? '0.00' : format.decimal(value, 2);
  const recordedTea = isNew ? '0' : typeof records?.tea_area === 'string' ? records.tea_area : null;
  const recordedCount = (key: CountField) => {
    if (isNew) return 0;
    const value = records?.[key];
    return typeof value === 'number' ? value : null;
  };

  // Total minus tea area (the typed one if there is one), never below zero: shown while non-tea area is not typed.
  const total = bind.total_area.value;
  const teaNow = isEntered(bind.tea_area.value) ? bind.tea_area.value : recordedTea;
  const autoNonTea = (() => {
    if (!isEntered(total) || teaNow === null) return null;
    try {
      const rest = new Dec(total).minus(teaNow);
      return rest.isNegative() ? '0' : rest.toFixed(3);
    } catch {
      return null;
    }
  })();

  const same = (a: string, b: string) => {
    try {
      return new Dec(a).eq(b);
    } catch {
      return false;
    }
  };

  const areaHint = (typed: string | null, recorded: string | null) => {
    if (!isEntered(typed)) return t('profile.overviewHints.auto');
    return recorded !== null && !same(typed, recorded)
      ? t('profile.overviewHints.records', { value: areaText(recorded) })
      : t('profile.overviewHints.entered');
  };
  const countHint = (key: CountField) => {
    const typed = bind[key].value;
    const recorded = recordedCount(key);
    if (typed === null) {
      return recorded === null ? t('profile.withHr') : t('profile.overviewHints.auto');
    }
    return recorded !== null && recorded !== typed
      ? t('profile.overviewHints.records', { value: format.number(recorded) })
      : t('profile.overviewHints.entered');
  };

  const area = (
    key: 'tea_area' | 'non_tea_area',
    label: string,
    placeholder: string | null,
    hint: string,
  ) => (
    <AreaInput
      label={label}
      hint={hint}
      placeholder={areaText(placeholder)}
      isReadOnly={isReadOnly}
      {...bind[key]}
    />
  );
  const count = (key: CountField, label: string) => (
    <NumberInput
      label={label}
      hint={countHint(key)}
      placeholder={format.number(recordedCount(key) ?? 0)}
      minValue={0}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
      isReadOnly={isReadOnly}
      {...bind[key]}
    />
  );

  return (
    <Card title={t('profile.overview')} headingLevel={2}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <AreaInput
          label={t('profile.overviewFields.totalArea')}
          hint={t('profile.overviewHints.declared')}
          placeholder="0.00"
          isReadOnly={isReadOnly}
          {...bind.total_area}
        />
        {area(
          'tea_area',
          t('profile.overviewFields.teaArea'),
          recordedTea,
          areaHint(bind.tea_area.value, recordedTea),
        )}
        {area(
          'non_tea_area',
          t('profile.overviewFields.nonTeaArea'),
          autoNonTea,
          areaHint(bind.non_tea_area.value, autoNonTea),
        )}
        {count('field_count', t('profile.overviewFields.fields'))}
        {count('division_count', t('profile.overviewFields.divisions'))}
        {count('section_count', t('profile.overviewFields.sections'))}
        {count('worker_count', t('profile.overviewFields.workers'))}
        {count('family_count', t('profile.overviewFields.families'))}
      </div>
    </Card>
  );
}
