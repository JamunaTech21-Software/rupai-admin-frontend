import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  AsyncCombobox,
  Button,
  Card,
  Checkbox,
  type ComboboxOption,
  DatePicker,
  Input,
  Textarea,
  toast,
} from '@/ui';

import {
  type BalanceProblem,
  balanceProblemOf,
  type Leave,
  type LeaveInput,
  useChangeLeave,
  useCreateLeave,
  useSubmitLeave,
} from '../api/leave';
import { searchProfiles } from '../api/profiles';
import { BalanceAlert } from './BalanceAlert';
import { LookupPick } from './LookupPick';

const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;
const blank = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * File, change and submit a leave request (leave.create): the leave type, dates (a half day is a single day), reason,
 * a phone to reach the person and a colleague who covers. Anyone files their own; those who may approve can file for
 * someone else. "Submit" keeps the request and sends it to the supervisor; a balance that does not cover it is
 * refused with the numbers.
 */
export function LeaveForm({
  leave,
  initialProblem,
  onRefused,
}: {
  /** The draft being changed, or null for a new request. */
  readonly leave: Leave | null;
  /** A balance refusal to show when the page opens (from a request that was kept as a draft and then refused). */
  readonly initialProblem?: BalanceProblem | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = leave === null;
  const draft = isNew || leave.state === 'draft';
  const canEdit = usePermission('leave.create') && draft;
  const forOthers = usePermission('leave.approve') && isNew;
  const create = useCreateLeave();
  const change = useChangeLeave(leave?.request_number ?? '');
  const submit = useSubmitLeave(leave?.request_number ?? '');
  const [covering, setCovering] = useState<ComboboxOption | null>(
    leave?.covering ? { id: leave.covering.id, label: leave.covering.full_name } : null,
  );
  const [employee, setEmployee] = useState<ComboboxOption | null>(null);
  const [problem, setProblem] = useState<BalanceProblem | null>(initialProblem ?? null);
  const [pendingKind, setPendingKind] = useState<'draft' | 'submit'>('draft');
  const format = useFormat();

  const schema = z
    .object({
      leave_type_id: z
        .string()
        .nullable()
        .refine((v) => v !== null, t('validation.leaveType')),
      from_date: z
        .string()
        .nullable()
        .refine((v) => v !== null, t('validation.fromDate')),
      to_date: z
        .string()
        .nullable()
        .refine((v) => v !== null, t('validation.toDate')),
      is_half_day: z.boolean(),
      reason: z
        .string()
        .trim()
        .max(500, t('validation.tooLong', { max: 500 })),
      contact: z
        .string()
        .trim()
        .refine((v) => v === '' || PHONE.test(v), t('validation.phone')),
    })
    .refine((v) => v.to_date >= v.from_date, {
      path: ['to_date'],
      message: t('validation.endBeforeStart'),
    })
    .refine((v) => !v.is_half_day || v.from_date === v.to_date, {
      path: ['is_half_day'],
      message: t('validation.halfDay'),
    });

  const form = useZodForm(schema, {
    defaultValues: {
      leave_type_id: leave?.leave_type_id ?? null,
      from_date: leave?.from_date ?? null,
      to_date: leave?.to_date ?? null,
      is_half_day: leave?.is_half_day ?? false,
      reason: leave?.reason ?? '',
      contact: leave?.contact_during_leave ?? '',
    },
  });
  const c = form.control;
  const bind = {
    leave_type_id: useFormField(c, 'leave_type_id'),
    from_date: useFormField(c, 'from_date'),
    to_date: useFormField(c, 'to_date'),
    is_half_day: useFormField(c, 'is_half_day'),
    reason: useFormField(c, 'reason'),
    contact: useFormField(c, 'contact'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const run = async (v: z.output<typeof schema>, kind: 'draft' | 'submit') => {
    setProblem(null);
    const base = {
      leave_type_id: v.leave_type_id,
      from_date: v.from_date,
      to_date: v.to_date,
      is_half_day: v.is_half_day,
      reason: blank(v.reason),
      contact_during_leave: blank(v.contact),
      covering_profile_id: covering?.id ?? null,
    };
    let saved: Leave | null = null;
    try {
      if (leave === null) {
        const input: LeaveInput = { ...base, ...(employee ? { employment_profile_id: employee.id } : {}) };
        saved = await create.mutateAsync(input);
      } else {
        saved = await change.mutateAsync({ leave, input: base });
      }
      if (kind === 'submit') {
        await submit.mutateAsync(saved);
        toast.success(t('leave.sent', { number: saved.request_number }));
      } else {
        toast.success(
          t(leave === null ? 'leave.draftSaved' : 'leave.saved', { number: saved.request_number }),
        );
      }
      void navigate('/hr/leave');
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      const refusal = balanceProblemOf(error);
      if (refusal) {
        // The request was kept as a draft: show the numbers where it can be changed.
        if (saved && leave === null)
          void navigate(`/hr/leave/${saved.id}`, { replace: true, state: { problem: refusal } });
        else setProblem(refusal);
        return;
      }
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const mapped = error.fieldErrors.map((d) =>
          d.field === 'leave_type_id' ||
          d.field === 'from_date' ||
          d.field === 'to_date' ||
          d.field === 'is_half_day'
            ? d
            : { ...d, field: d.field === 'contact_during_leave' ? 'contact' : 'reason' },
        );
        if (applyServerErrors(form, mapped).length === 0) return;
      }
      onRefused(error);
    }
  };
  const go = (kind: 'draft' | 'submit') => {
    setPendingKind(kind);
    void form.handleSubmit((v) => run(v, kind))();
  };
  const pending = create.isPending || change.isPending || submit.isPending;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        go('draft');
      }}
    >
      {!canEdit && draft ? <PermissionNotice /> : null}
      {problem ? <BalanceAlert problem={problem} /> : null}
      <Card title={t('leave.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {forOthers ? (
            <AsyncCombobox
              label={t('leave.forWhom')}
              hint={t('leave.forWhomHint')}
              placeholder={t('leave.mine')}
              emptyMessage={t('leave.noPerson')}
              value={employee}
              onChange={setEmployee}
              loadOptions={({ query, cursor, signal }) => searchProfiles(query, cursor, signal)}
            />
          ) : null}
          <LookupPick
            type="leave_type"
            label={t('leave.type')}
            value={bind.leave_type_id.value}
            current={leave?.leave_type ?? null}
            isDisabled={!canEdit}
            onChange={bind.leave_type_id.onChange}
            error={bind.leave_type_id.error}
          />
          <DatePicker
            label={t('leave.from')}
            isRequired
            isDisabled={!canEdit}
            value={bind.from_date.value}
            onChange={(next) => {
              bind.from_date.onChange(next);
              if (bind.is_half_day.value) bind.to_date.onChange(next);
            }}
            {...(bind.from_date.error ? { error: bind.from_date.error } : {})}
          />
          <DatePicker
            label={t('leave.to')}
            isRequired
            isDisabled={!canEdit || bind.is_half_day.value}
            value={bind.to_date.value}
            onChange={bind.to_date.onChange}
            {...(bind.to_date.error ? { error: bind.to_date.error } : {})}
          />
          <div className="flex flex-col justify-end gap-1">
            <Checkbox
              isSelected={bind.is_half_day.value}
              isDisabled={!canEdit}
              onChange={(next) => {
                bind.is_half_day.onChange(next);
                if (next) bind.to_date.onChange(bind.from_date.value);
              }}
            >
              {t('leave.halfDay')}
            </Checkbox>
            {bind.is_half_day.error ? <p className="text-sm text-danger">{bind.is_half_day.error}</p> : null}
          </div>
          <Input
            label={t('leave.contact')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.contact}
            {...readOnly}
          />
          <AsyncCombobox
            label={t('leave.covering')}
            placeholder={t('leave.coveringPlaceholder')}
            emptyMessage={t('leave.noPerson')}
            isReadOnly={!canEdit}
            value={covering}
            onChange={setCovering}
            loadOptions={({ query, cursor, signal }) => searchProfiles(query, cursor, signal)}
          />
          <Textarea
            label={t('leave.reason')}
            placeholder={t('leave.reasonPlaceholder')}
            rows={2}
            maxLength={500}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.reason}
            {...readOnly}
          />
          {leave ? (
            <p className="text-sm text-fg-muted sm:col-span-2 xl:col-span-3">
              {t('leave.daysCounted', { days: format.decimal(leave.day_count, 1) })}
            </p>
          ) : null}
        </div>
      </Card>
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            isPending={pending && pendingKind === 'draft'}
            className="w-full sm:w-auto"
            onPress={() => {
              go('draft');
            }}
          >
            {t(isNew ? 'leave.saveDraft' : 'leave.save')}
          </Button>
          <Button
            isPending={pending && pendingKind === 'submit'}
            className="w-full sm:w-auto"
            onPress={() => {
              go('submit');
            }}
          >
            {t('leave.submit')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
