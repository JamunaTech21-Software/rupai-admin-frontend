import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAllEstates } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import {
  AsyncCombobox,
  Button,
  Card,
  type ComboboxOption,
  DatePicker,
  Input,
  MoneyInput,
  Select,
  Textarea,
  toast,
} from '@/ui';

import {
  BENEFICIARY_TYPES,
  type CaseInput,
  useChangeCase,
  useCreateCase,
  useSubmitCase,
  type WelfareCase,
  WELFARE_CATEGORIES,
} from '../api/benefits';
import { searchPersons } from '../api/persons';
import { searchProfiles } from '../api/profiles';

const NONE = 'none';
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Open or change a welfare case (welfare.create): the garden, who it is for (an employee or worker, any registered
 * person, or the community), the kind of help, the date, what happened and the amount asked for. A draft is kept or
 * submitted for approval; submitting needs the amount.
 */
export function WelfareForm({
  welfareCase,
  onRefused,
}: {
  readonly welfareCase: WelfareCase | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = welfareCase === null;
  const draft = isNew || welfareCase.state === 'draft';
  const canEdit = usePermission(isNew ? 'welfare.create' : 'welfare.edit') && draft;
  const estates = useAllEstates();
  const create = useCreateCase();
  const change = useChangeCase(welfareCase?.case_number ?? '');
  const submit = useSubmitCase(welfareCase?.case_number ?? '');
  const [estate, setEstate] = useState<string | null>(welfareCase?.estate_id ?? null);
  const [kind, setKind] = useState<WelfareCase['beneficiary_type']>(
    welfareCase?.beneficiary_type ?? 'employment_profile',
  );
  const [who, setWho] = useState<ComboboxOption | null>(
    welfareCase?.beneficiary_id && welfareCase.beneficiary_name
      ? { id: welfareCase.beneficiary_id, label: welfareCase.beneficiary_name }
      : null,
  );
  const [category, setCategory] = useState<WelfareCase['welfare_category']>(
    welfareCase?.welfare_category ?? 'medical',
  );
  const [date, setDate] = useState<string | null>(welfareCase?.case_date ?? todayIso());
  const [description, setDescription] = useState(welfareCase?.description ?? '');
  const [amount, setAmount] = useState<string | null>(welfareCase?.requested_amount ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kindPending, setKindPending] = useState<'draft' | 'submit'>('draft');
  const pending = create.isPending || change.isPending || submit.isPending;

  const go = async (andSubmit: boolean) => {
    setKindPending(andSubmit ? 'submit' : 'draft');
    const found: Record<string, string> = {};
    if (isNew && estate === null) found.estate_id = t('validation.estate');
    if (kind !== 'community' && who === null) found.beneficiary_id = t('validation.beneficiary');
    if (date === null) found.case_date = t('validation.required');
    if (description.trim().length < 3) found.description = t('validation.description');
    if (andSubmit && amount === null) found.requested_amount = t('validation.amountAsked');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input: CaseInput = {
      beneficiary_type: kind,
      beneficiary_id: kind === 'community' ? null : (who?.id ?? null),
      welfare_category: category,
      case_date: date ?? todayIso(),
      description: description.trim(),
      requested_amount: amount,
    };
    try {
      const saved = welfareCase
        ? await change.mutateAsync({ welfareCase, changes: input })
        : await create.mutateAsync({ ...input, estate_id: estate ?? '' });
      if (andSubmit) {
        await submit.mutateAsync(saved);
        toast.success(t('welfare.sent', { number: saved.case_number }));
      } else {
        toast.success(t(isNew ? 'welfare.draftSaved' : 'welfare.saved', { number: saved.case_number }));
      }
      void navigate('/hr/welfare');
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of error.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
      onRefused(error);
    }
  };

  const err = (key: string) => (errors[key] ? { error: errors[key] } : {});

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void go(false);
      }}
    >
      {!canEdit && draft ? <PermissionNotice /> : null}
      <Card title={t('welfare.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {welfareCase ? (
            <Input
              label={t('welfare.estate')}
              value={estates.data?.find((e) => e.id === welfareCase.estate_id)?.name ?? ''}
              isReadOnly
            />
          ) : (
            <Select
              label={t('welfare.estate')}
              placeholder={t('form.select')}
              isRequired
              value={estate ?? NONE}
              options={(estates.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }))}
              onChange={(next) => {
                setEstate(next === null || next === NONE ? null : next);
              }}
              {...err('estate_id')}
            />
          )}
          <Select
            label={t('welfare.forWhom')}
            isDisabled={!canEdit}
            value={kind}
            options={BENEFICIARY_TYPES.map((value) => ({ id: value, label: t(`beneficiaryTypes.${value}`) }))}
            onChange={(next) => {
              setKind(BENEFICIARY_TYPES.find((value) => value === next) ?? 'employment_profile');
              setWho(null);
            }}
          />
          {kind === 'community' ? (
            <p className="self-end pb-2 text-sm text-fg-muted">{t('welfare.communityHint')}</p>
          ) : (
            <AsyncCombobox
              key={kind}
              label={t(kind === 'person' ? 'welfare.person' : 'welfare.employee')}
              isRequired
              isReadOnly={!canEdit}
              placeholder={t('form.personPlaceholder')}
              emptyMessage={t('leave.noPerson')}
              value={who}
              onChange={setWho}
              loadOptions={({ query, cursor, signal }) =>
                kind === 'person'
                  ? searchPersons(query, cursor, signal)
                  : searchProfiles(query, cursor, signal)
              }
              {...err('beneficiary_id')}
            />
          )}
          <Select
            label={t('welfare.category')}
            isDisabled={!canEdit}
            value={category}
            options={WELFARE_CATEGORIES.map((value) => ({
              id: value,
              label: t(`welfareCategories.${value}`),
            }))}
            onChange={(next) => {
              setCategory(WELFARE_CATEGORIES.find((value) => value === next) ?? 'other');
            }}
          />
          <DatePicker
            label={t('welfare.caseDate')}
            isRequired
            isDisabled={!canEdit}
            value={date}
            onChange={setDate}
            {...err('case_date')}
          />
          <MoneyInput
            label={t('welfare.requested')}
            hint={t('welfare.requestedHint')}
            isDisabled={!canEdit}
            value={amount}
            onChange={setAmount}
            {...err('requested_amount')}
          />
          <Textarea
            label={t('welfare.description')}
            placeholder={t('welfare.placeholders.description')}
            rows={3}
            maxLength={500}
            isRequired
            isReadOnly={!canEdit}
            className="sm:col-span-2 xl:col-span-3"
            value={description}
            onChange={setDescription}
            {...err('description')}
          />
        </div>
      </Card>
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            isPending={pending && kindPending === 'draft'}
            onPress={() => {
              void go(false);
            }}
          >
            {t(isNew ? 'welfare.saveDraft' : 'welfare.save')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            isPending={pending && kindPending === 'submit'}
            onPress={() => {
              void go(true);
            }}
          >
            {t('welfare.submit')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
