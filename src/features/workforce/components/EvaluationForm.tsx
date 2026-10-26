import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { type LookupRow, lookupText, useActiveLookups } from '@/lib/lookups';
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
  EVALUATION_TYPES,
  type Evaluation,
  type EvaluationInput,
  type LineInput,
  useChangeEvaluation,
  useCreateEvaluation,
  useSubmitEvaluation,
} from '../api/performance';
import { searchProfiles } from '../api/profiles';
import { RatingBadge } from './EvaluationStateBadge';

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());
const asNumber = (value: string | null) => (value === null ? null : new Dec(value).toNumber());

/** One criterion being scored: what it is, how high it can go, and what the reviewer entered. */
interface Row {
  readonly criteriaId: string;
  readonly name: string;
  readonly group: string;
  readonly maxScore: string;
  readonly goalId: string | null;
  score: number | null;
  weight: number | null;
  comment: string;
}

const rowOf = (criteria: LookupRow): Row => ({
  criteriaId: criteria.id,
  name: lookupText(criteria, 'name') || lookupText(criteria, 'code'),
  group: lookupText(criteria, 'criteria_group'),
  maxScore: lookupText(criteria, 'max_score') || '5.00',
  goalId: null,
  score: null,
  weight: 1,
  comment: '',
});

const rowOfLine = (line: Evaluation['lines'][number]): Row => ({
  criteriaId: line.criteria_id,
  name: line.criteria.name,
  group: line.criteria.criteria_group,
  maxScore: line.max_score,
  goalId: line.goal_id,
  score: asNumber(line.score),
  weight: asNumber(line.weight),
  comment: line.comment ?? '',
});

/**
 * Score someone (evaluation.create / evaluation.edit while it is a draft): who and by whom, the period, a score on
 * each criterion, and the written comments. The overall score and rating are worked out by the backend and only
 * shown. A draft is kept or sent for approval, which needs every criterion scored.
 */
export function EvaluationForm({
  evaluation,
  onRefused,
}: {
  readonly evaluation: Evaluation | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = evaluation === null;
  const draft = isNew || evaluation.state === 'draft';
  const canEdit = usePermission(isNew ? 'evaluation.create' : 'evaluation.edit') && draft;
  const canReadLookups = usePermission('lookup.view');
  const criteria = useActiveLookups('evaluation_criteria', canReadLookups && isNew);
  const create = useCreateEvaluation();
  const change = useChangeEvaluation(evaluation?.evaluation_number ?? '');
  const submit = useSubmitEvaluation(evaluation?.evaluation_number ?? '');
  const [employee, setEmployee] = useState<ComboboxOption | null>(null);
  const [reviewer, setReviewer] = useState<ComboboxOption | null>(
    evaluation?.reviewer ? { id: evaluation.reviewer.id, label: evaluation.reviewer.full_name } : null,
  );
  const [type, setType] = useState<Evaluation['evaluation_type']>(evaluation?.evaluation_type ?? 'annual');
  const [start, setStart] = useState<string | null>(evaluation?.period_start ?? null);
  const [end, setEnd] = useState<string | null>(evaluation?.period_end ?? null);
  const [strengths, setStrengths] = useState(evaluation?.strengths ?? '');
  const [needs, setNeeds] = useState(evaluation?.development_needs ?? '');
  const [comment, setComment] = useState(evaluation?.reviewer_comment ?? '');
  const [edited, setEdited] = useState<Record<string, Row>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [which, setWhich] = useState<'draft' | 'submit'>('draft');
  const pending = create.isPending || change.isPending || submit.isPending;

  // The rows: the evaluation's own lines, or (for a new one) every active criterion, with what has been entered.
  const base = evaluation ? evaluation.lines.map(rowOfLine) : (criteria.data ?? []).map(rowOf);
  const rows = base.map((row) => edited[row.criteriaId] ?? row);
  const update = (row: Row, patch: Partial<Row>) => {
    setEdited((current) => ({ ...current, [row.criteriaId]: { ...row, ...patch } }));
  };

  const go = async (andSubmit: boolean) => {
    setWhich(andSubmit ? 'submit' : 'draft');
    const found: Record<string, string> = {};
    if (isNew && employee === null) found.employment_profile_id = t('validation.employee');
    if (start === null) found.period_start = t('validation.required');
    if (end === null) found.period_end = t('validation.required');
    if (start !== null && end !== null && end < start) found.period_end = t('validation.endBeforeStart');
    rows.forEach((row, index) => {
      if (row.score !== null && row.score > new Dec(row.maxScore).toNumber())
        found[`lines[${String(index)}].score`] = t('evaluations.scoreMax', { max: row.maxScore });
      if (andSubmit && row.score === null)
        found[`lines[${String(index)}].score`] = t('validation.scoreEvery');
    });
    if (andSubmit && rows.length === 0) found.lines = t('validation.scoreEvery');
    setErrors(found);
    if (Object.keys(found).length > 0 || start === null || end === null) return;
    const input: EvaluationInput = {
      reviewer_profile_id: reviewer?.id ?? null,
      period_start: start,
      period_end: end,
      evaluation_type: type,
      strengths: orNull(strengths),
      development_needs: orNull(needs),
      reviewer_comment: orNull(comment),
    };
    const lines: LineInput[] = rows.map((row) => ({
      criteria_id: row.criteriaId,
      ...(row.weight === null ? {} : { weight: new Dec(row.weight).toFixed(2) }),
      score: row.score === null ? null : new Dec(row.score).toFixed(2),
      ...(row.goalId === null ? {} : { goal_id: row.goalId }),
      comment: orNull(row.comment),
    }));
    try {
      const saved = evaluation
        ? await change.mutateAsync({ evaluation, changes: input, lines })
        : await create.mutateAsync({ ...input, employment_profile_id: employee?.id ?? '', lines });
      if (andSubmit) {
        await submit.mutateAsync(saved);
        toast.success(t('evaluations.sent', { number: saved.evaluation_number }));
      } else {
        toast.success(
          t(isNew ? 'evaluations.draftSaved' : 'evaluations.saved', { number: saved.evaluation_number }),
        );
      }
      void navigate('/hr/evaluations');
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
  const searchPeople = ({
    query,
    cursor,
    signal,
  }: {
    query: string;
    cursor: string | null;
    signal: AbortSignal;
  }) => searchProfiles(query, cursor, signal);

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
      <Card title={t('evaluations.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {evaluation ? (
            <Input
              label={t('evaluations.employee')}
              value={`${evaluation.profile.profile_number} · ${evaluation.profile.full_name}`}
              isReadOnly
            />
          ) : (
            <AsyncCombobox
              label={t('evaluations.employee')}
              isRequired
              placeholder={t('form.personPlaceholder')}
              emptyMessage={t('leave.noPerson')}
              value={employee}
              onChange={setEmployee}
              loadOptions={searchPeople}
              {...err('employment_profile_id')}
            />
          )}
          <AsyncCombobox
            label={t('evaluations.reviewer')}
            isDisabled={!canEdit}
            placeholder={t('form.personPlaceholder')}
            emptyMessage={t('leave.noPerson')}
            value={reviewer}
            onChange={setReviewer}
            loadOptions={searchPeople}
            {...err('reviewer_profile_id')}
          />
          <Select
            label={t('evaluations.type')}
            isDisabled={!canEdit}
            value={type}
            options={EVALUATION_TYPES.map((value) => ({ id: value, label: t(`evaluationTypes.${value}`) }))}
            onChange={(next) => {
              setType(EVALUATION_TYPES.find((value) => value === next) ?? 'annual');
            }}
          />
          <DatePicker
            label={t('evaluations.periodStart')}
            isRequired
            isDisabled={!canEdit}
            value={start}
            onChange={setStart}
            {...err('period_start')}
          />
          <DatePicker
            label={t('evaluations.periodEnd')}
            isRequired
            isDisabled={!canEdit}
            value={end}
            onChange={setEnd}
            {...err('period_end')}
          />
          {evaluation ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-fg">{t('evaluations.overall')}</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tabular-nums">{evaluation.overall_score ?? '—'}</span>
                <RatingBadge rating={evaluation.overall_rating} />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
      <Card title={t('evaluations.criteria')} headingLevel={2}>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {criteria.isPending && isNew ? t('evaluations.loadingCriteria') : t('evaluations.noCriteria')}
          </p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {rows.map((row, index) => (
              <li
                key={row.criteriaId}
                className="grid grid-cols-1 gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-6"
              >
                <div className="sm:col-span-6">
                  <p className="font-medium text-fg">{row.name}</p>
                  {row.group ? <p className="text-sm text-fg-muted">{row.group}</p> : null}
                </div>
                <NumberInput
                  label={t('evaluations.score', { max: row.maxScore })}
                  className="sm:col-span-2"
                  isDisabled={!canEdit}
                  minValue={0}
                  formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
                  value={row.score}
                  onChange={(next) => {
                    update(row, { score: next });
                  }}
                  {...err(`lines[${String(index)}].score`)}
                />
                <NumberInput
                  label={t('evaluations.weight')}
                  className="sm:col-span-1"
                  isDisabled={!canEdit}
                  minValue={0}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  value={row.weight}
                  onChange={(next) => {
                    update(row, { weight: next });
                  }}
                  {...err(`lines[${String(index)}].weight`)}
                />
                <Input
                  label={t('evaluations.lineComment')}
                  className="sm:col-span-3"
                  isReadOnly={!canEdit}
                  maxLength={500}
                  value={row.comment}
                  onChange={(next) => {
                    update(row, { comment: next });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {errors.lines ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {errors.lines}
          </p>
        ) : null}
      </Card>
      <Card title={t('evaluations.comments')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <Textarea
            label={t('evaluations.strengths')}
            rows={3}
            maxLength={1000}
            isReadOnly={!canEdit}
            value={strengths}
            onChange={setStrengths}
            {...err('strengths')}
          />
          <Textarea
            label={t('evaluations.developmentNeeds')}
            rows={3}
            maxLength={1000}
            isReadOnly={!canEdit}
            value={needs}
            onChange={setNeeds}
            {...err('development_needs')}
          />
          <Textarea
            label={t('evaluations.reviewerComment')}
            rows={3}
            maxLength={1000}
            isReadOnly={!canEdit}
            className="sm:col-span-2"
            value={comment}
            onChange={setComment}
            {...err('reviewer_comment')}
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
            {t(isNew ? 'evaluations.saveDraft' : 'evaluations.save')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            isPending={pending && which === 'submit'}
            onPress={() => {
              void go(true);
            }}
          >
            {t('evaluations.submit')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
