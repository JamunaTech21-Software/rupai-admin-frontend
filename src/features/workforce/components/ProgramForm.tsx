import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAllEstates } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import { Button, Card, DatePicker, Input, MoneyInput, NumberInput, Select, Textarea, toast } from '@/ui';

import {
  type Program,
  type ProgramInput,
  TRAINER_TYPES,
  TRAINING_TYPES,
  useChangeProgram,
  useCreateProgram,
  useProgramAction,
} from '../api/training';

const NONE = 'none';
const todayIso = () => new Date().toISOString().slice(0, 10);
const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

/**
 * Plan or change a training programme (training.create / training.edit while it is a draft): the estate, what it is,
 * who trains and where, when, the hours, the seats and the cost. A draft is kept or submitted for approval.
 */
export function ProgramForm({
  program,
  onRefused,
}: {
  readonly program: Program | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = program === null;
  const draft = isNew || program.state === 'draft';
  const canEdit = usePermission(isNew ? 'training.create' : 'training.edit') && draft;
  const estates = useAllEstates();
  const create = useCreateProgram();
  const change = useChangeProgram(program?.program_code ?? '');
  const submit = useProgramAction('submit', program?.program_code ?? '');
  const [estate, setEstate] = useState<string | null>(program?.estate_id ?? null);
  const [title, setTitle] = useState(program?.title ?? '');
  const [type, setType] = useState<Program['training_type']>(program?.training_type ?? 'skill');
  const [trainerType, setTrainerType] = useState<Program['trainer_type']>(
    program?.trainer_type ?? 'internal',
  );
  const [trainer, setTrainer] = useState(program?.trainer_name ?? '');
  const [venue, setVenue] = useState(program?.venue ?? '');
  const [start, setStart] = useState<string | null>(program?.start_date ?? todayIso());
  const [end, setEnd] = useState<string | null>(program?.end_date ?? todayIso());
  const [hours, setHours] = useState<number | null>(
    program?.duration_hours ? new Dec(program.duration_hours).toNumber() : null,
  );
  const [capacity, setCapacity] = useState<number | null>(program?.capacity ?? null);
  const [cost, setCost] = useState<string | null>(program?.cost ?? null);
  const [description, setDescription] = useState(program?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [which, setWhich] = useState<'draft' | 'submit'>('draft');
  const pending = create.isPending || change.isPending || submit.isPending;

  const go = async (andSubmit: boolean) => {
    setWhich(andSubmit ? 'submit' : 'draft');
    const found: Record<string, string> = {};
    if (isNew && estate === null) found.estate_id = t('validation.estate');
    if (title.trim().length < 3) found.title = t('validation.programTitle');
    if (start === null) found.start_date = t('validation.required');
    if (end === null) found.end_date = t('validation.required');
    if (start !== null && end !== null && end < start) found.end_date = t('validation.endBeforeStart');
    setErrors(found);
    if (Object.keys(found).length > 0 || start === null || end === null) return;
    const input: ProgramInput = {
      title: title.trim(),
      training_type: type,
      trainer_name: orNull(trainer),
      trainer_type: trainerType,
      venue: orNull(venue),
      start_date: start,
      end_date: end,
      duration_hours: hours === null ? null : new Dec(hours).toFixed(2),
      capacity,
      cost,
      description: orNull(description),
    };
    try {
      const saved = program
        ? await change.mutateAsync({ program, changes: input })
        : await create.mutateAsync({ ...input, estate_id: estate ?? '' });
      if (andSubmit) {
        await submit.mutateAsync(saved);
        toast.success(t('training.sent', { code: saved.program_code }));
      } else {
        toast.success(t(isNew ? 'training.draftSaved' : 'training.saved', { code: saved.program_code }));
      }
      void navigate('/hr/training');
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
      <Card title={t('training.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {program ? (
            <Input label={t('training.estate')} value={program.estate.name} isReadOnly />
          ) : (
            <Select
              label={t('training.estate')}
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
          <Input
            label={t('training.programTitle')}
            placeholder={t('training.placeholders.title')}
            isRequired
            isReadOnly={!canEdit}
            maxLength={200}
            className="xl:col-span-2"
            value={title}
            onChange={setTitle}
            {...err('title')}
          />
          <Select
            label={t('training.type')}
            isDisabled={!canEdit}
            value={type}
            options={TRAINING_TYPES.map((value) => ({ id: value, label: t(`trainingTypes.${value}`) }))}
            onChange={(next) => {
              setType(TRAINING_TYPES.find((value) => value === next) ?? 'other');
            }}
          />
          <Select
            label={t('training.trainerType')}
            isDisabled={!canEdit}
            value={trainerType}
            options={TRAINER_TYPES.map((value) => ({ id: value, label: t(`trainerTypes.${value}`) }))}
            onChange={(next) => {
              setTrainerType(TRAINER_TYPES.find((value) => value === next) ?? 'internal');
            }}
          />
          <Input
            label={t('training.trainer')}
            placeholder={t('training.placeholders.trainer')}
            isReadOnly={!canEdit}
            maxLength={150}
            value={trainer}
            onChange={setTrainer}
          />
          <Input
            label={t('training.venue')}
            placeholder={t('training.placeholders.venue')}
            isReadOnly={!canEdit}
            maxLength={200}
            value={venue}
            onChange={setVenue}
          />
          <DatePicker
            label={t('training.start')}
            isRequired
            isDisabled={!canEdit}
            value={start}
            onChange={setStart}
            {...err('start_date')}
          />
          <DatePicker
            label={t('training.end')}
            isRequired
            isDisabled={!canEdit}
            value={end}
            onChange={setEnd}
            {...err('end_date')}
          />
          <NumberInput
            label={t('training.hours')}
            isDisabled={!canEdit}
            minValue={0}
            formatOptions={{ maximumFractionDigits: 2 }}
            value={hours}
            onChange={setHours}
            {...err('duration_hours')}
          />
          <NumberInput
            label={t('training.capacity')}
            hint={t('training.capacityHint')}
            isDisabled={!canEdit}
            minValue={1}
            value={capacity}
            onChange={setCapacity}
            {...err('capacity')}
          />
          <MoneyInput
            label={t('training.cost')}
            hint={t('training.costHint')}
            isDisabled={!canEdit}
            value={cost}
            onChange={setCost}
            {...err('cost')}
          />
          <Textarea
            label={t('training.notes')}
            rows={3}
            maxLength={1000}
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
            {t(isNew ? 'training.saveDraft' : 'training.save')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            isPending={pending && which === 'submit'}
            onPress={() => {
              void go(true);
            }}
          >
            {t('training.submit')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
