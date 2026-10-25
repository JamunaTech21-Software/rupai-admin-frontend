import { useState } from 'react';
import { z } from 'zod';

import { useEstateSections } from '@/features/organisation';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import { Button, DatePicker, Modal, MoneyInput, Select, Textarea, toast } from '@/ui';

import {
  type Assignment,
  type AssignmentInput,
  CHANGE_REASONS,
  PAY_COMPONENTS,
  type PayComponent,
  useChangeAssignment,
  useStartAssignment,
  useSubmitAssignment,
  WAGE_BASES,
} from '../api/assignments';
import { type Profile } from '../api/profileSchemas';
import { LookupPick } from './LookupPick';

const NONE = 'none';
const todayIso = () => new Date().toISOString().slice(0, 10);

/** What a change starts from: the assignment in force, or nothing for the first one. */
export interface AssignmentEditor {
  /** A draft being changed; null starts a new change. */
  readonly draft: Assignment | null;
  /** The assignment in force today (its terms are copied into a new change), if any. */
  readonly current: Assignment | null;
}

/**
 * Start or change an assignment: a transfer, promotion, demotion, wage revision or other change from a date. It can
 * be kept as a draft or submitted at once; a change in pay then waits for approval. A worker needs a section and a
 * job / task, an employee a department and a designation (the design's Employment and Salary & Payroll sections).
 */
export function AssignmentModal({
  profile,
  editor,
  isFirst,
  onClose,
  onRefused,
}: {
  readonly profile: Profile;
  readonly editor: AssignmentEditor;
  /** The profile has no assignment yet: the first one starts on the joining date, as "joining". */
  readonly isFirst: boolean;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const start = useStartAssignment(profile.id);
  const change = useChangeAssignment(profile.id, profile.profile_number);
  const submitDraft = useSubmitAssignment(profile.id, profile.profile_number);
  const sections = useEstateSections(profile.estate_id);
  // Which button was pressed, for its spinner; the save itself is told directly.
  const [shown, setShown] = useState<'draft' | 'submit'>('submit');
  const source = editor.draft ?? editor.current;
  const isEmployee = profile.employment_type === 'employee';
  const linesOf = (a: Assignment | null) =>
    Object.fromEntries(
      PAY_COMPONENTS.map((c) => [c, a?.pay_lines.find((l) => l.component === c)?.amount ?? null]),
    );

  const schema = z
    .object({
      effective_from: z.string().nullable(),
      change_reason: z.enum(CHANGE_REASONS),
      department_id: z.string().nullable(),
      designation_id: z.string().nullable(),
      section_id: z.string().nullable(),
      activity_type_id: z.string().nullable(),
      default_shift_id: z.string().nullable(),
      wage_basis: z.enum(WAGE_BASES),
      base_rate: z.string().nullable(),
      basic: z.string().nullable(),
      house_rent: z.string().nullable(),
      medical: z.string().nullable(),
      conveyance: z.string().nullable(),
      other: z.string().nullable(),
      remarks: z.string().trim().max(500),
    })
    .refine((v) => v.effective_from !== null, {
      path: ['effective_from'],
      message: t('validation.effectiveFrom'),
    })
    .refine((v) => !isEmployee || v.department_id !== null, {
      path: ['department_id'],
      message: t('validation.department'),
    })
    .refine((v) => !isEmployee || v.designation_id !== null, {
      path: ['designation_id'],
      message: t('validation.designation'),
    })
    .refine((v) => isEmployee || v.section_id !== null, {
      path: ['section_id'],
      message: t('validation.section'),
    })
    .refine((v) => isEmployee || v.activity_type_id !== null, {
      path: ['activity_type_id'],
      message: t('validation.activity'),
    })
    .refine((v) => v.basic !== null || PAY_COMPONENTS.every((c) => v[c] === null), {
      path: ['basic'],
      message: t('validation.basicRequired'),
    });

  const form = useZodForm(schema, {
    defaultValues: {
      effective_from: editor.draft?.effective_from ?? (isFirst ? profile.joining_date : todayIso()),
      change_reason: editor.draft?.change_reason ?? (isFirst ? 'joining' : 'transfer'),
      department_id: source?.department_id ?? null,
      designation_id: source?.designation_id ?? null,
      section_id: source?.section_id ?? null,
      activity_type_id: source?.activity_type_id ?? null,
      default_shift_id: source?.default_shift_id ?? null,
      wage_basis: source?.wage_basis ?? (isEmployee ? 'monthly' : 'daily'),
      base_rate: source?.base_rate ?? null,
      ...linesOf(source),
      remarks: editor.draft?.remarks ?? '',
    } as z.input<typeof schema>,
  });
  const c = form.control;
  const bind = {
    effective_from: useFormField(c, 'effective_from'),
    change_reason: useFormField(c, 'change_reason'),
    department_id: useFormField(c, 'department_id'),
    designation_id: useFormField(c, 'designation_id'),
    section_id: useFormField(c, 'section_id'),
    activity_type_id: useFormField(c, 'activity_type_id'),
    default_shift_id: useFormField(c, 'default_shift_id'),
    wage_basis: useFormField(c, 'wage_basis'),
    base_rate: useFormField(c, 'base_rate'),
    basic: useFormField(c, 'basic'),
    house_rent: useFormField(c, 'house_rent'),
    medical: useFormField(c, 'medical'),
    conveyance: useFormField(c, 'conveyance'),
    other: useFormField(c, 'other'),
    remarks: useFormField(c, 'remarks'),
  };
  const lines: Record<PayComponent, typeof bind.basic> = {
    basic: bind.basic,
    house_rent: bind.house_rent,
    medical: bind.medical,
    conveyance: bind.conveyance,
    other: bind.other,
  };
  const total = PAY_COMPONENTS.reduce((sum, key) => {
    const value = lines[key].value;
    return value === null ? sum : sum.plus(value);
  }, new Dec(0));
  const hasLines = PAY_COMPONENTS.some((key) => lines[key].value !== null);
  const pending = start.isPending || change.isPending || submitDraft.isPending;

  const run = async (v: z.output<typeof schema>, kind: 'draft' | 'submit') => {
    const input: AssignmentInput = {
      effective_from: v.effective_from ?? '',
      change_reason: v.change_reason,
      department_id: v.department_id,
      designation_id: v.designation_id,
      section_id: v.section_id,
      activity_type_id: v.activity_type_id,
      default_shift_id: v.default_shift_id,
      wage_basis: v.wage_basis,
      base_rate: v.base_rate,
      pay_lines: PAY_COMPONENTS.flatMap((key) =>
        v[key] === null ? [] : [{ component: key, amount: v[key] }],
      ),
      remarks: v.remarks.trim() === '' ? null : v.remarks.trim(),
    };
    try {
      const saved = editor.draft
        ? await change.mutateAsync({ assignment: editor.draft, input })
        : await start.mutateAsync(input);
      if (kind === 'submit') {
        const result = await submitDraft.mutateAsync(saved);
        toast.success(
          t(result.state === 'submitted' ? 'assignments.sentForApproval' : 'assignments.inEffect', {
            date: format.date(result.effective_from),
          }),
        );
      } else {
        toast.success(t('assignments.draftSaved'));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const mapped = error.fieldErrors.map((d) =>
          d.field?.startsWith('pay_lines') ? { ...d, field: 'basic' } : d,
        );
        if (applyServerErrors(form, mapped).length === 0) return;
      }
      onRefused(error);
      onClose();
    }
  };
  /** Save, and submit as well when asked: validated first, as the form's own submit is. */
  const save = (kind: 'draft' | 'submit') => {
    setShown(kind);
    void form.handleSubmit((v) => run(v, kind))();
  };

  const pickOptions = <T extends string>(list: readonly T[], name: (item: T) => string) => [
    ...list.map((item) => ({ id: item, label: name(item) })),
  ];

  return (
    <Modal
      isOpen
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(
        editor.draft ? 'assignments.editTitle' : isFirst ? 'assignments.firstTitle' : 'assignments.newTitle',
        {
          name: profile.person.full_name,
        },
      )}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="secondary"
            isPending={pending && shown === 'draft'}
            onPress={() => {
              save('draft');
            }}
          >
            {t('assignments.saveDraft')}
          </Button>
          <Button
            isPending={pending && shown === 'submit'}
            onPress={() => {
              save('submit');
            }}
          >
            {t('assignments.submit')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <DatePicker
          label={t('assignments.effectiveFrom')}
          isRequired
          isDisabled={isFirst}
          value={bind.effective_from.value}
          onChange={bind.effective_from.onChange}
          {...(bind.effective_from.error ? { error: bind.effective_from.error } : {})}
        />
        <Select
          label={t('assignments.reason')}
          isRequired
          isDisabled={isFirst}
          value={bind.change_reason.value}
          options={pickOptions(
            isFirst ? CHANGE_REASONS : CHANGE_REASONS.filter((r) => r !== 'joining'),
            (r) => t(`changeReasons.${r}`),
          )}
          onChange={(next) => {
            const found = CHANGE_REASONS.find((r) => r === next);
            if (found) bind.change_reason.onChange(found);
          }}
        />
        {isEmployee ? (
          <>
            <LookupPick
              type="department"
              label={t('assignments.department')}
              value={bind.department_id.value}
              current={source?.department ?? null}
              onChange={bind.department_id.onChange}
            />
            <LookupPick
              type="designation"
              label={t('assignments.designation')}
              value={bind.designation_id.value}
              current={source?.designation ?? null}
              onChange={bind.designation_id.onChange}
            />
            {bind.department_id.error || bind.designation_id.error ? (
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                {bind.department_id.error ?? bind.designation_id.error}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <Select
              label={t('assignments.section')}
              placeholder={t('form.select')}
              isRequired
              value={bind.section_id.value ?? NONE}
              options={sections.sections.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))}
              onChange={(next) => {
                bind.section_id.onChange(next === null || next === NONE ? null : next);
              }}
              {...(bind.section_id.error ? { error: bind.section_id.error } : {})}
            />
            <LookupPick
              type="activity_type"
              label={t('assignments.activity')}
              value={bind.activity_type_id.value}
              current={source?.activity_type ?? null}
              onChange={bind.activity_type_id.onChange}
            />
            {bind.activity_type_id.error ? (
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                {bind.activity_type_id.error}
              </p>
            ) : null}
          </>
        )}
        <LookupPick
          type="shift"
          label={t('assignments.shift')}
          value={bind.default_shift_id.value}
          current={source?.default_shift ?? null}
          onChange={bind.default_shift_id.onChange}
        />
        <Select
          label={t('assignments.wageBasis')}
          isRequired
          value={bind.wage_basis.value}
          options={pickOptions(WAGE_BASES, (w) => t(`wageBases.${w}`))}
          onChange={(next) => {
            const found = WAGE_BASES.find((w) => w === next);
            if (found) bind.wage_basis.onChange(found);
          }}
        />
        <MoneyInput
          label={t('assignments.baseRate')}
          hint={t('assignments.baseRateHint')}
          scale={4}
          value={bind.base_rate.value}
          onChange={bind.base_rate.onChange}
        />
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-fg">{t('assignments.salary')}</legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {PAY_COMPONENTS.map((key) => (
              <MoneyInput
                key={key}
                label={t(`payComponents.${key}`)}
                isRequired={key === 'basic' && hasLines}
                value={lines[key].value}
                onChange={lines[key].onChange}
                {...(lines[key].error ? { error: lines[key].error } : {})}
              />
            ))}
          </div>
          <p className="text-sm text-fg-muted">
            {t('assignments.totalAuto')}:{' '}
            <span className="font-medium text-fg figures">{format.money(total.toFixed(4))}</span>
          </p>
        </fieldset>
        <Textarea
          label={t('assignments.remarks')}
          placeholder={t('assignments.remarksPlaceholder')}
          rows={2}
          maxLength={500}
          className="sm:col-span-2"
          {...bind.remarks}
        />
      </form>
    </Modal>
  );
}
