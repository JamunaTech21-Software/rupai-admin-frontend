import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import { Button, Card, DatePicker, EmptyState, Modal, NumberInput, Skeleton, Textarea, toast } from '@/ui';

import { type Goal, isLive, useGoalProgress, useRecordProgress } from '../api/performance';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Record the value (or percentage) reached on a day. */
function RecordModal({
  goal,
  onClose,
  onRefused,
}: {
  readonly goal: Goal;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const record = useRecordProgress(goal.id);
  const [date, setDate] = useState<string | null>(todayIso());
  const [value, setValue] = useState<number | null>(null);
  const [percentage, setPercentage] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasTarget = goal.target_value !== null;
  const err = (key: string) => (errors[key] ? { error: errors[key] } : {});

  const save = async () => {
    const found: Record<string, string> = {};
    if (date === null) found.progress_date = t('validation.required');
    if (hasTarget ? value === null : percentage === null)
      found[hasTarget ? 'value' : 'progress_percentage'] = t(
        hasTarget ? 'validation.progressValue' : 'validation.progressPercentage',
      );
    setErrors(found);
    if (Object.keys(found).length > 0 || date === null) return;
    try {
      await record.mutateAsync({
        progress_date: date,
        value: value === null ? null : new Dec(value).toFixed(4),
        ...(!hasTarget && percentage !== null ? { progress_percentage: new Dec(percentage).toFixed(2) } : {}),
        note: note.trim() === '' ? null : note.trim(),
      });
      toast.success(t('goals.progressSaved', { code: goal.goal_code }));
      onClose();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of failure.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
      onRefused(failure);
      onClose();
    }
  };

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('goals.recordTitle', { code: goal.goal_code })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={record.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('goals.saveProgress')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <DatePicker
          label={t('goals.progressDate')}
          isRequired
          value={date}
          onChange={setDate}
          {...err('progress_date')}
        />
        {hasTarget ? (
          <NumberInput
            label={t('goals.progressValue', { unit: goal.measure_unit ?? '' })}
            hint={t('goals.progressValueHint', { target: goal.target_value ?? '' })}
            isRequired
            minValue={0}
            formatOptions={{ maximumFractionDigits: 4 }}
            value={value}
            onChange={setValue}
            {...err('value')}
          />
        ) : (
          <NumberInput
            label={t('goals.progressPercentage')}
            isRequired
            minValue={0}
            maxValue={100}
            formatOptions={{ maximumFractionDigits: 2 }}
            value={percentage}
            onChange={setPercentage}
            {...err('progress_percentage')}
          />
        )}
        <Textarea
          label={t('goals.note')}
          rows={2}
          maxLength={500}
          className="sm:col-span-2"
          value={note}
          onChange={setNote}
        />
      </div>
    </Modal>
  );
}

/**
 * A goal's progress (goal.view): the percentage so far and every update, newest first. "Record progress" is for a live
 * goal (goal.edit).
 */
export function GoalProgress({
  goal,
  onRefused,
}: {
  readonly goal: Goal;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canEdit = usePermission('goal.edit');
  const list = useGoalProgress(goal.id);
  const [recording, setRecording] = useState(false);
  const rows = [...(list.data ?? [])].sort((a, b) => b.progress_date.localeCompare(a.progress_date));

  return (
    <Card
      title={t('goals.progress')}
      headingLevel={2}
      actions={
        canEdit && isLive(goal.state) ? (
          <Button
            size="sm"
            iconStart="plus"
            onPress={() => {
              setRecording(true);
            }}
          >
            {t('goals.record')}
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-fg-muted">{t('goals.achieved')}: </span>
          <span className="font-semibold">{format.decimal(goal.progress_percentage, 1)}%</span>
        </span>
        {goal.target_value ? (
          <span className="text-fg-muted">
            {format.decimal(goal.current_value, 1)} / {format.decimal(goal.target_value, 1)}{' '}
            {goal.measure_unit ?? ''}
          </span>
        ) : null}
      </div>
      {list.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={2} />
      ) : list.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState kind="new" title={t('goals.noProgressTitle')} description={t('goals.noProgressBody')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">{format.date(row.progress_date)}</span>
                {row.note ? <span className="text-fg-muted">{row.note}</span> : null}
              </span>
              <span>{format.decimal(row.progress_percentage, 1)}%</span>
              <span className="text-fg-muted">{row.recorded_by.username}</span>
            </li>
          ))}
        </ul>
      )}
      {recording ? (
        <RecordModal
          goal={goal}
          onClose={() => {
            setRecording(false);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </Card>
  );
}
