import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  AsyncCombobox,
  Button,
  type ComboboxOption,
  DatePicker,
  Input,
  Modal,
  MoneyInput,
  QuantityInput,
  toast,
} from '@/ui';

import {
  type BenefitEntitlement,
  type EntitlementInput,
  useChangeEntitlement,
  useCreateEntitlement,
  useSubmitEntitlement,
} from '../api/benefits';
import { searchProfiles } from '../api/profiles';
import { LookupPick } from './LookupPick';

interface Draft {
  benefit_type_id: string | null;
  effective_from: string | null;
  effective_to: string | null;
  allocation_reference: string;
  issuing_office: string;
  quantity_per_period: string | null;
  employer_cost_per_period: string | null;
  employee_contribution: string | null;
}

/**
 * Give a person a benefit (benefit.create): the design's Ration Card (card no., issue date, valid till, dealer / office)
 * and what each period brings. It is kept as a draft, or sent for approval at once; only an approved entitlement counts.
 */
export function EntitlementModal({
  entitlement,
  profile,
  onClose,
  onRefused,
}: {
  /** A draft being changed; null starts a new entitlement. */
  readonly entitlement: BenefitEntitlement | null;
  /** The person it is for, when it is opened from their page; otherwise the form asks. */
  readonly profile: { readonly id: string; readonly name: string } | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const create = useCreateEntitlement();
  const change = useChangeEntitlement(entitlement?.profile.full_name ?? '');
  const submit = useSubmitEntitlement(entitlement?.profile.full_name ?? profile?.name ?? '');
  const [person, setPerson] = useState<ComboboxOption | null>(
    entitlement
      ? { id: entitlement.employment_profile_id, label: entitlement.profile.full_name }
      : profile
        ? { id: profile.id, label: profile.name }
        : null,
  );
  const [d, setD] = useState<Draft>({
    benefit_type_id: entitlement?.benefit_type_id ?? null,
    effective_from: entitlement?.effective_from ?? null,
    effective_to: entitlement?.effective_to ?? null,
    allocation_reference: entitlement?.allocation_reference ?? '',
    issuing_office: entitlement?.issuing_office ?? '',
    quantity_per_period: entitlement?.quantity_per_period ?? null,
    employer_cost_per_period: entitlement?.employer_cost_per_period ?? null,
    employee_contribution: entitlement?.employee_contribution ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = create.isPending || change.isPending || submit.isPending;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setD((current) => ({ ...current, [key]: value }));
  };
  const err = (key: string) => (errors[key] ? { error: errors[key] } : {});

  const save = async (andSubmit: boolean) => {
    const found: Record<string, string> = {};
    if (person === null) found.person = t('validation.person');
    if (d.benefit_type_id === null) found.benefit_type_id = t('validation.benefitType');
    if (d.effective_from === null) found.effective_from = t('validation.issueDate');
    if (d.effective_to !== null && d.effective_from !== null && d.effective_to < d.effective_from)
      found.effective_to = t('validation.endBeforeStart');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input: EntitlementInput = {
      benefit_type_id: d.benefit_type_id ?? '',
      effective_from: d.effective_from ?? '',
      effective_to: d.effective_to,
      quantity_per_period: d.quantity_per_period,
      employer_cost_per_period: d.employer_cost_per_period,
      employee_contribution: d.employee_contribution ?? new Dec(0).toFixed(4),
      allocation_reference: d.allocation_reference.trim() === '' ? null : d.allocation_reference.trim(),
      issuing_office: d.issuing_office.trim() === '' ? null : d.issuing_office.trim(),
    };
    try {
      const saved = entitlement
        ? await change.mutateAsync({ entitlement, changes: input })
        : await create.mutateAsync({ ...input, employment_profile_id: person?.id ?? '' });
      if (andSubmit) {
        await submit.mutateAsync(saved);
        toast.success(t('benefits.sent', { name: saved.profile.full_name }));
      } else {
        toast.success(t('benefits.draftSaved', { name: saved.profile.full_name }));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of error.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
      onRefused(error);
      onClose();
    }
  };

  return (
    <Modal
      isOpen
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(entitlement ? 'benefits.editTitle' : 'benefits.newTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="secondary"
            isPending={pending}
            onPress={() => {
              void save(false);
            }}
          >
            {t('benefits.saveDraft')}
          </Button>
          <Button
            isPending={pending}
            onPress={() => {
              void save(true);
            }}
          >
            {t('benefits.submit')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {entitlement || profile ? (
          <Input label={t('benefits.person')} value={person?.label ?? ''} isReadOnly />
        ) : (
          <AsyncCombobox
            label={t('benefits.person')}
            isRequired
            placeholder={t('form.personPlaceholder')}
            emptyMessage={t('leave.noPerson')}
            value={person}
            onChange={setPerson}
            loadOptions={({ query, cursor, signal }) => searchProfiles(query, cursor, signal)}
            {...err('person')}
          />
        )}
        <LookupPick
          type="benefit_type"
          label={t('benefits.type')}
          value={d.benefit_type_id}
          current={entitlement?.benefit_type ?? null}
          onChange={(next) => {
            set('benefit_type_id', next);
          }}
          error={errors.benefit_type_id}
        />
        <Input
          label={t('benefits.reference')}
          placeholder={t('benefits.placeholders.reference')}
          value={d.allocation_reference}
          onChange={(next) => {
            set('allocation_reference', next);
          }}
        />
        <Input
          label={t('benefits.office')}
          placeholder={t('benefits.placeholders.office')}
          value={d.issuing_office}
          onChange={(next) => {
            set('issuing_office', next);
          }}
        />
        <DatePicker
          label={t('benefits.from')}
          isRequired
          value={d.effective_from}
          onChange={(next) => {
            set('effective_from', next);
          }}
          {...err('effective_from')}
        />
        <DatePicker
          label={t('benefits.to')}
          hint={t('benefits.toHint')}
          value={d.effective_to}
          onChange={(next) => {
            set('effective_to', next);
          }}
          {...err('effective_to')}
        />
        <QuantityInput
          label={t('benefits.quantity')}
          value={d.quantity_per_period}
          onChange={(next) => {
            set('quantity_per_period', next);
          }}
          {...err('quantity_per_period')}
        />
        <MoneyInput
          label={t('benefits.cost')}
          value={d.employer_cost_per_period}
          onChange={(next) => {
            set('employer_cost_per_period', next);
          }}
          {...err('employer_cost_per_period')}
        />
        <MoneyInput
          label={t('benefits.contribution')}
          hint={t('benefits.contributionHint')}
          value={d.employee_contribution}
          onChange={(next) => {
            set('employee_contribution', next);
          }}
          {...err('employee_contribution')}
        />
      </div>
    </Modal>
  );
}
