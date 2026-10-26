import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Input,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@/ui';

import { useEstateProfiles } from '../api/profiles';
import {
  ATTENDANCE,
  type Participant,
  type Program,
  RESULTS,
  useAddParticipants,
  useParticipants,
  useRecordParticipant,
  useRemoveParticipant,
} from '../api/training';

const TONES: Record<Participant['attendance_status'], BadgeTone> = {
  registered: 'neutral',
  attended: 'success',
  absent: 'danger',
  withdrawn: 'neutral',
};

/** Register people on a programme: the current profiles of its estate who are not already on it. */
function AddParticipantsModal({
  program,
  current,
  onClose,
  onRefused,
}: {
  readonly program: Program;
  readonly current: readonly Participant[];
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const profiles = useEstateProfiles(program.estate_id);
  const add = useAddParticipants(program.id);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(current.map((row) => row.employment_profile_id));
  const options = (profiles.data ?? [])
    .filter((profile) => !taken.has(profile.id))
    .map((profile) => ({ id: profile.id, label: `${profile.person.full_name} (${profile.profile_number})` }));

  const send = async () => {
    if (picked.length === 0) {
      setError(t('training.pickPeople'));
      return;
    }
    try {
      await add.mutateAsync(picked);
      toast.success(t('training.added', { count: picked.length }));
      onClose();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
        setError(failure.fieldErrors[0]?.message ?? failure.message);
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
      title={t('training.addTitle', { title: program.title })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={add.isPending}
            onPress={() => {
              void send();
            }}
          >
            {t('training.addPeople')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {program.seats_left !== null ? (
          <p className="text-sm text-fg-muted">{t('training.seatsLeft', { count: program.seats_left })}</p>
        ) : null}
        <MultiSelect
          label={t('training.people')}
          placeholder={t('form.select')}
          isRequired
          value={picked}
          options={options}
          onChange={(next) => {
            setPicked(next);
            setError(null);
          }}
          {...(error ? { error } : {})}
        />
      </div>
    </Modal>
  );
}

/** Attendance, score, result, certificate and feedback of one participant. */
function RecordModal({
  program,
  participant,
  onClose,
  onRefused,
}: {
  readonly program: Program;
  readonly participant: Participant;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const name = participant.profile.full_name;
  const record = useRecordParticipant(program.id, name);
  const [attendance, setAttendance] = useState(participant.attendance_status);
  const [score, setScore] = useState<number | null>(
    participant.score ? new Dec(participant.score).toNumber() : null,
  );
  const [result, setResult] = useState(participant.result);
  const [number, setNumber] = useState(participant.certificate_number ?? '');
  const [issued, setIssued] = useState<string | null>(participant.certificate_issued_on);
  const [rating, setRating] = useState<number | null>(participant.feedback_rating);
  const [remarks, setRemarks] = useState(participant.remarks ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const err = (key: string) => (errors[key] ? { error: errors[key] } : {});

  const save = async () => {
    try {
      await record.mutateAsync({
        participant,
        changes: {
          attendance_status: attendance,
          score: score === null ? null : new Dec(score).toFixed(2),
          result,
          certificate_number: number.trim() === '' ? null : number.trim(),
          certificate_issued_on: issued,
          feedback_rating: rating,
          remarks: remarks.trim() === '' ? null : remarks.trim(),
        },
      });
      toast.success(t('training.recorded', { name }));
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
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('training.recordTitle', { name })}
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
            {t('training.saveResult')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Select
          label={t('training.attendance')}
          value={attendance}
          options={ATTENDANCE.map((value) => ({ id: value, label: t(`attendance.${value}`) }))}
          onChange={(next) => {
            setAttendance(ATTENDANCE.find((value) => value === next) ?? 'registered');
          }}
          {...err('attendance_status')}
        />
        <Select
          label={t('training.result')}
          value={result}
          options={RESULTS.map((value) => ({ id: value, label: t(`trainingResults.${value}`) }))}
          onChange={(next) => {
            setResult(RESULTS.find((value) => value === next) ?? 'not_assessed');
          }}
          {...err('result')}
        />
        <NumberInput
          label={t('training.score')}
          hint={t('training.scoreHint')}
          minValue={0}
          maxValue={100}
          formatOptions={{ maximumFractionDigits: 2 }}
          value={score}
          onChange={setScore}
          {...err('score')}
        />
        <NumberInput
          label={t('training.rating')}
          hint={t('training.ratingHint')}
          minValue={1}
          maxValue={5}
          value={rating}
          onChange={setRating}
          {...err('feedback_rating')}
        />
        <Input
          label={t('training.certificate')}
          placeholder={t('training.placeholders.certificate')}
          maxLength={50}
          value={number}
          onChange={setNumber}
          {...err('certificate_number')}
        />
        <DatePicker
          label={t('training.issuedOn')}
          value={issued}
          onChange={setIssued}
          {...err('certificate_issued_on')}
        />
        <Textarea
          label={t('training.remarks')}
          rows={2}
          maxLength={500}
          className="sm:col-span-2"
          value={remarks}
          onChange={setRemarks}
        />
      </div>
    </Modal>
  );
}

/**
 * A programme's participants (training.view): who is registered and how they did. People are registered while the
 * programme is a draft or planned; attendance and results are recorded once it is approved (training.edit).
 */
export function ParticipantsPanel({
  program,
  onRefused,
}: {
  readonly program: Program;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canEdit = usePermission('training.edit');
  const list = useParticipants(program.id);
  const remove = useRemoveParticipant(program.id);
  const [adding, setAdding] = useState(false);
  const [recording, setRecording] = useState<Participant | null>(null);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const rows = list.data ?? [];
  const open = program.state === 'draft' || program.state === 'approved';

  return (
    <Card
      title={t('training.participants')}
      headingLevel={2}
      actions={
        canEdit && open ? (
          <Button
            size="sm"
            iconStart="plus"
            onPress={() => {
              setAdding(true);
            }}
          >
            {t('training.addPeople')}
          </Button>
        ) : undefined
      }
    >
      {list.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={3} />
      ) : list.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          kind="new"
          title={t('training.noParticipantsTitle')}
          description={t('training.noParticipantsBody')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex min-w-40 flex-col">
                <span className="font-medium">{row.profile.full_name}</span>
                <span className="font-mono text-fg-muted">{row.profile.profile_number}</span>
              </span>
              <Badge tone={TONES[row.attendance_status]} label={t(`attendance.${row.attendance_status}`)} />
              <span className="flex flex-col text-fg-muted">
                <span>
                  {t(`trainingResults.${row.result}`)}
                  {row.score ? ` · ${format.decimal(row.score, 1)}` : ''}
                </span>
                {row.certificate_number ? (
                  <span>
                    {t('training.certificate')}: {row.certificate_number}
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <span className="flex flex-wrap items-center gap-2">
                  {program.state === 'approved' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setRecording(row);
                      }}
                    >
                      {t('training.record')}
                      <span className="sr-only"> {row.profile.full_name}</span>
                    </Button>
                  ) : null}
                  {open && row.attendance_status === 'registered' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setRemoving(row);
                      }}
                    >
                      {t('training.remove')}
                      <span className="sr-only"> {row.profile.full_name}</span>
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddParticipantsModal
          program={program}
          current={rows}
          onClose={() => {
            setAdding(false);
          }}
          onRefused={onRefused}
        />
      ) : null}
      {recording ? (
        <RecordModal
          program={program}
          participant={recording}
          onClose={() => {
            setRecording(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoving(null);
        }}
        title={t('training.removeTitle', { name: removing?.profile.full_name ?? '' })}
        consequence={t('training.removeBody')}
        confirmLabel={t('training.remove')}
        tone="danger"
        onConfirm={async () => {
          if (removing) {
            try {
              await remove.mutateAsync(removing);
              toast.success(t('training.removed', { name: removing.profile.full_name }));
            } catch (failure) {
              onRefused(failure);
            }
          }
          setRemoving(null);
        }}
      />
    </Card>
  );
}
