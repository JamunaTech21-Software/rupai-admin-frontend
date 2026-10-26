import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAllEstates } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  AsyncCombobox,
  Button,
  Card,
  type ComboboxOption,
  DatePicker,
  Input,
  NumberInput,
  Select,
  Textarea,
  toast,
} from '@/ui';

import {
  GOAL_OWNER_TYPES,
  type Goal,
  type GoalInput,
  useChangeGoal,
  useCreateGoal,
  useGoalAction,
} from '../api/performance';
import { searchProfiles } from '../api/profiles';
import { LookupPick } from './LookupPick';

const NONE = 'none';
const todayIso = () => new Date().toISOString().slice(0, 10);
const orNull = (text: string) => (text.trim() === '' ? null : text.trim());
const asNumber = (value: string | null) => (value === null ? null : new Dec(value).toNumber());

/**
 * Set or change a goal (goal.create / goal.edit while it is a draft): whose it is (a person, a department or an
 * estate), what is to be achieved and how it is measured, and its dates. A draft is kept or sent for approval.
 */
export function GoalForm({
  goal,
  onRefused,
}: {
  readonly goal: Goal | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = goal === null;
  const draft = isNew || goal.state === 'draft';
  const canEdit = usePermission(isNew ? 'goal.create' : 'goal.edit') && draft;
  const estates = useAllEstates();
  const create = useCreateGoal();
  const change = useChangeGoal(goal?.goal_code ?? '');
  const submit = useGoalAction('submit', goal?.goal_code ?? '');
  const [ownerType, setOwnerType] = useState<Goal['owner_type']>(goal?.owner_type ?? 'employment_profile');
  const [profile, setProfile] = useState<ComboboxOption | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [estate, setEstate] = useState<string | null>(goal?.estate_id ?? null);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [kpi, setKpi] = useState(goal?.kpi_name ?? '');
  const [unit, setUnit] = useState(goal?.measure_unit ?? '');
  const [target, setTarget] = useState<number | null>(asNumber(goal?.target_value ?? null));
  const [weight, setWeight] = useState<number | null>(asNumber(goal?.weight ?? null));
  const [start, setStart] = useState<string | null>(goal?.start_date ?? todayIso());
  const [due, setDue] = useState<string | null>(goal?.due_date ?? null);
  const [review, setReview] = useState<string | null>(goal?.review_date ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [which, setWhich] = useState<'draft' | 'submit'>('draft');
  const pending = create.isPending || change.isPending || submit.isPending;

  const go = async (andSubmit: boolean) => {
    setWhich(andSubmit ? 'submit' : 'draft');
    const found: Record<string, string> = {};
    const ownerId =
      ownerType === 'employment_profile' ? profile?.id : ownerType === 'department' ? department : estate;
    if (isNew && !ownerId) found.owner_id = t(`validation.owner.${ownerType}`);
    if (isNew && ownerType === 'department' && estate === null) found.estate_id = t('validation.estate');
    if (title.trim().length < 3) found.title = t('validation.goalTitle');
    if (start === null) found.start_date = t('validation.required');
    if (due === null) found.due_date = t('validation.required');
    if (start !== null && due !== null && due < start) found.due_date = t('validation.endBeforeStart');
    setErrors(found);
    if (Object.keys(found).length > 0 || start === null || due === null) return;
    const input: GoalInput = {
      parent_goal_id: goal?.parent_goal_id ?? null,
      title: title.trim(),
      description: orNull(description),
      kpi_name: orNull(kpi),
      measure_unit: orNull(unit),
      target_value: target === null ? null : new Dec(target).toFixed(4),
      weight: weight === null ? null : new Dec(weight).toFixed(2),
      start_date: start,
      due_date: due,
      review_date: review,
    };
    try {
      const saved = goal
        ? await change.mutateAsync({ goal, changes: input })
        : await create.mutateAsync({
            ...input,
            owner_type: ownerType,
            owner_id: ownerId ?? '',
            ...(ownerType === 'department' && estate ? { estate_id: estate } : {}),
          });
      if (andSubmit) {
        await submit.mutateAsync(saved);
        toast.success(t('goals.sent', { code: saved.goal_code }));
      } else {
        toast.success(t(isNew ? 'goals.draftSaved' : 'goals.saved', { code: saved.goal_code }));
      }
      void navigate('/hr/goals');
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
  const estateOptions = (estates.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }));

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
      <Card title={t('goals.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {goal ? (
            <>
              <Input label={t('goals.ownerType')} value={t(`goalOwnerTypes.${goal.owner_type}`)} isReadOnly />
              <Input label={t('goals.owner')} value={goal.owner_name ?? ''} isReadOnly />
            </>
          ) : (
            <>
              <Select
                label={t('goals.ownerType')}
                value={ownerType}
                options={GOAL_OWNER_TYPES.map((value) => ({
                  id: value,
                  label: t(`goalOwnerTypes.${value}`),
                }))}
                onChange={(next) => {
                  setOwnerType(GOAL_OWNER_TYPES.find((value) => value === next) ?? 'employment_profile');
                  setErrors({});
                }}
              />
              {ownerType === 'employment_profile' ? (
                <AsyncCombobox
                  label={t('goals.owner')}
                  isRequired
                  placeholder={t('form.personPlaceholder')}
                  emptyMessage={t('leave.noPerson')}
                  value={profile}
                  onChange={setProfile}
                  loadOptions={({ query, cursor, signal }) => searchProfiles(query, cursor, signal)}
                  {...err('owner_id')}
                />
              ) : ownerType === 'department' ? (
                <LookupPick
                  type="department"
                  label={t('goals.owner')}
                  value={department}
                  current={null}
                  onChange={setDepartment}
                  error={errors.owner_id}
                />
              ) : (
                <Select
                  label={t('goals.owner')}
                  placeholder={t('form.select')}
                  isRequired
                  value={estate ?? NONE}
                  options={estateOptions}
                  onChange={(next) => {
                    setEstate(next === null || next === NONE ? null : next);
                  }}
                  {...err('owner_id')}
                />
              )}
              {ownerType === 'department' ? (
                <Select
                  label={t('goals.estate')}
                  placeholder={t('form.select')}
                  isRequired
                  value={estate ?? NONE}
                  options={estateOptions}
                  onChange={(next) => {
                    setEstate(next === null || next === NONE ? null : next);
                  }}
                  {...err('estate_id')}
                />
              ) : null}
            </>
          )}
          <Input
            label={t('goals.goalTitle')}
            placeholder={t('goals.placeholders.title')}
            isRequired
            isReadOnly={!canEdit}
            maxLength={200}
            className="sm:col-span-2 xl:col-span-3"
            value={title}
            onChange={setTitle}
            {...err('title')}
          />
          <Input
            label={t('goals.kpi')}
            placeholder={t('goals.placeholders.kpi')}
            isReadOnly={!canEdit}
            maxLength={150}
            value={kpi}
            onChange={setKpi}
          />
          <Input
            label={t('goals.unit')}
            placeholder={t('goals.placeholders.unit')}
            isReadOnly={!canEdit}
            maxLength={50}
            value={unit}
            onChange={setUnit}
          />
          <NumberInput
            label={t('goals.target')}
            hint={t('goals.targetHint')}
            isDisabled={!canEdit}
            minValue={0}
            formatOptions={{ maximumFractionDigits: 4 }}
            value={target}
            onChange={setTarget}
            {...err('target_value')}
          />
          <NumberInput
            label={t('goals.weight')}
            hint={t('goals.weightHint')}
            isDisabled={!canEdit}
            minValue={0}
            maxValue={100}
            formatOptions={{ maximumFractionDigits: 2 }}
            value={weight}
            onChange={setWeight}
            {...err('weight')}
          />
          <DatePicker
            label={t('goals.start')}
            isRequired
            isDisabled={!canEdit}
            value={start}
            onChange={setStart}
            {...err('start_date')}
          />
          <DatePicker
            label={t('goals.due')}
            isRequired
            isDisabled={!canEdit}
            value={due}
            onChange={setDue}
            {...err('due_date')}
          />
          <DatePicker
            label={t('goals.review')}
            isDisabled={!canEdit}
            value={review}
            onChange={setReview}
            {...err('review_date')}
          />
          <Textarea
            label={t('goals.notes')}
            rows={3}
            maxLength={500}
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
            isPending={pending && which === 'draft'}
            onPress={() => {
              void go(false);
            }}
          >
            {t(isNew ? 'goals.saveDraft' : 'goals.save')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            isPending={pending && which === 'submit'}
            onPress={() => {
              void go(true);
            }}
          >
            {t('goals.submit')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
