import { useAllEstates } from '@/features/organisation';
import { useFormat, useTranslation } from '@/lib/i18n';
import { DatePicker, Input, MoneyInput, Select, Textarea } from '@/ui';

import { type ContractDraft } from '../api/contractDraft';
import { PAYMENT_TERMS, RATE_BASES, WORK_LOCATIONS, WORK_TYPES } from '../api/contractors';
import { LookupPick } from './LookupPick';

const NONE = 'none';

/** The months from one date to another, rounded up (the design's Contract Duration). */
function monthsBetween(from: string, to: string): number {
  const [fy = 0, fm = 0, fd = 0] = from.split('-').map((part) => Number.parseInt(part, 10));
  const [ty = 0, tm = 0, td = 0] = to.split('-').map((part) => Number.parseInt(part, 10));
  const months = (ty - fy) * 12 + (tm - fm);
  return Math.max(0, td >= fd ? months + 1 : months);
}

/**
 * The fields of a contract (the design's Contract Information): the estate, kind of work, how it is paid, the dates
 * with the duration that follows from them, the value, payment terms, where it is done and who it reports to. A
 * controlled set of fields: the caller keeps the draft and the errors.
 */
export function ContractFields({
  value,
  onChange,
  errors,
  isDisabled = false,
}: {
  readonly value: ContractDraft;
  readonly onChange: (next: ContractDraft) => void;
  readonly errors: Readonly<Record<string, string>>;
  readonly isDisabled?: boolean;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const estates = useAllEstates();
  const set = <K extends keyof ContractDraft>(key: K, next: ContractDraft[K]) => {
    onChange({ ...value, [key]: next });
  };
  const error = (key: string) => (errors[key] ? { error: errors[key] } : {});
  const pickOf = <T extends string>(list: readonly T[], next: string | null): T | null =>
    list.find((item) => item === next) ?? null;
  const months =
    value.start_date !== null && value.end_date !== null && value.end_date >= value.start_date
      ? monthsBetween(value.start_date, value.end_date)
      : null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
      <Select
        label={t('contract.estate')}
        placeholder={t('form.select')}
        isRequired
        isDisabled={isDisabled}
        value={value.estate_id ?? NONE}
        options={(estates.data ?? []).map((estate) => ({
          id: estate.id,
          label: `${estate.code} · ${estate.name}`,
        }))}
        onChange={(next) => {
          set('estate_id', next === null || next === NONE ? null : next);
        }}
        {...error('estate_id')}
      />
      <Input
        label={t('contract.reference')}
        placeholder={t('contract.placeholders.reference')}
        isReadOnly={isDisabled}
        value={value.reference_number}
        onChange={(next) => {
          set('reference_number', next);
        }}
      />
      <Select
        label={t('contract.workType')}
        placeholder={t('form.select')}
        isRequired
        isDisabled={isDisabled}
        value={value.work_type ?? NONE}
        options={WORK_TYPES.map((item) => ({ id: item, label: t(`workTypes.${item}`) }))}
        onChange={(next) => {
          set('work_type', pickOf(WORK_TYPES, next));
        }}
        {...error('work_type')}
      />
      <Select
        label={t('contract.rateBasis')}
        placeholder={t('form.select')}
        isRequired
        isDisabled={isDisabled}
        value={value.rate_basis ?? NONE}
        options={RATE_BASES.map((item) => ({ id: item, label: t(`rateBases.${item}`) }))}
        onChange={(next) => {
          set('rate_basis', pickOf(RATE_BASES, next));
        }}
        {...error('rate_basis')}
      />
      <MoneyInput
        label={t('contract.rate')}
        scale={4}
        isRequired
        isDisabled={isDisabled}
        value={value.rate}
        onChange={(next) => {
          set('rate', next);
        }}
        {...error('rate')}
      />
      <MoneyInput
        label={t('contract.value')}
        isRequired={value.rate_basis === 'lump_sum'}
        isDisabled={isDisabled}
        value={value.contract_value}
        onChange={(next) => {
          set('contract_value', next);
        }}
        {...error('contract_value')}
      />
      <DatePicker
        label={t('contract.start')}
        isRequired
        isDisabled={isDisabled}
        value={value.start_date}
        onChange={(next) => {
          set('start_date', next);
        }}
        {...error('start_date')}
      />
      <DatePicker
        label={t('contract.end')}
        isRequired
        isDisabled={isDisabled}
        value={value.end_date}
        onChange={(next) => {
          set('end_date', next);
        }}
        {...error('end_date')}
      />
      <Input
        label={t('contract.duration')}
        value={months === null ? '' : t('contract.months', { count: format.number(months) })}
        isReadOnly
      />
      <Select
        label={t('contract.paymentTerms')}
        placeholder={t('form.select')}
        isDisabled={isDisabled}
        value={value.payment_terms ?? NONE}
        options={[
          { id: NONE, label: t('form.notRecorded') },
          ...PAYMENT_TERMS.map((item) => ({ id: item, label: t(`paymentTerms.${item}`) })),
        ]}
        onChange={(next) => {
          set('payment_terms', pickOf(PAYMENT_TERMS, next));
        }}
      />
      <Select
        label={t('contract.workLocation')}
        placeholder={t('form.select')}
        isDisabled={isDisabled}
        value={value.work_location ?? NONE}
        options={[
          { id: NONE, label: t('form.notRecorded') },
          ...WORK_LOCATIONS.map((item) => ({ id: item, label: t(`workLocations.${item}`) })),
        ]}
        onChange={(next) => {
          set('work_location', pickOf(WORK_LOCATIONS, next));
        }}
      />
      <LookupPick
        type="designation"
        label={t('contract.reportingTo')}
        value={value.reporting_to_designation_id}
        current={null}
        isDisabled={isDisabled}
        onChange={(next) => {
          set('reporting_to_designation_id', next);
        }}
      />
      <MoneyInput
        label={t('contract.retention')}
        scale={2}
        currencySymbol="%"
        isDisabled={isDisabled}
        value={value.retention_percentage}
        onChange={(next) => {
          set('retention_percentage', next);
        }}
        {...error('retention_percentage')}
      />
      <Textarea
        label={t('contract.terms')}
        placeholder={t('contract.placeholders.terms')}
        rows={3}
        className="sm:col-span-2 xl:col-span-3"
        isReadOnly={isDisabled}
        value={value.terms}
        onChange={(next) => {
          set('terms', next);
        }}
      />
    </div>
  );
}
