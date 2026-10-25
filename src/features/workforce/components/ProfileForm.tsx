import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useAllEstates } from '@/features/organisation';
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
  DescriptionList,
  Input,
  Link,
  Select,
  Textarea,
  Alert,
} from '@/ui';
import { toast } from '@/ui';

import { searchPersons, usePerson } from '../api/persons';
import {
  type NewProfileInput,
  type ProfileInput,
  useCreateProfile,
  useEstateProfiles,
  useUpdateProfile,
} from '../api/profiles';
import {
  EMPLOYMENT_BASES,
  EMPLOYMENT_TYPES,
  ENGAGEMENT_TYPES,
  type EmploymentType,
  JOB_NATURES,
  type Profile,
  WORKING_LOCATIONS,
} from '../api/profileSchemas';
import { RELATIONS } from '../api/schemas';
import { LookupPick } from './LookupPick';

const NONE = 'none';
const ID_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 /-]*$/;
const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;
const NUMBER = /^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/;
const blank = (value: string) => (value.trim() === '' ? null : value.trim());
const pick = <T extends string>(list: readonly T[], value: string | null): T | null =>
  list.find((item) => item === value) ?? null;

export interface ProfileFormProps {
  /** The profile being changed, or null for a new one. */
  readonly profile: Profile | null;
  /** For a new profile: the kind to start with, and the person when the form was opened from their page. */
  readonly initialType?: EmploymentType | undefined;
  readonly initialPersonId?: string | undefined;
  readonly onRefused: (error: unknown) => void;
}

/**
 * Open or change a person's employment (the employment sections of the design's Add New Worker / Employee): pick the
 * person first, then the garden, kind, engagement, dates, reporting line and nominee. The department, designation,
 * section, job and wage come from the assignment (P2.03). A separated profile is read-only.
 */
export function ProfileForm({ profile, initialType, initialPersonId, onRefused }: ProfileFormProps) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const navigate = useNavigate();
  const isNew = profile === null;
  const separated = profile?.status === 'separated';
  const canEdit = usePermission(isNew ? 'employment.create' : 'employment.edit') && !separated;
  const create = useCreateProfile();
  const update = useUpdateProfile(profile ?? { id: '', version: 0, profile_number: '' });
  const estates = useAllEstates();
  const prefill = usePerson(initialPersonId ?? '');
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  const person: ComboboxOption | null =
    picked ??
    (prefill.data
      ? { id: prefill.data.id, label: prefill.data.full_name, description: prefill.data.person_code }
      : null);

  const schema = z
    .object({
      estate_id: z.string().nullable(),
      employment_type: z.enum(EMPLOYMENT_TYPES).nullable(),
      profile_number: z
        .string()
        .trim()
        .max(40)
        .refine((v) => v === '' || NUMBER.test(v), t('validation.profileNumber')),
      category_id: z.string().nullable(),
      engagement_type: z.enum(ENGAGEMENT_TYPES).nullable(),
      employment_basis: z.enum(EMPLOYMENT_BASES).nullable(),
      job_nature: z.enum(JOB_NATURES).nullable(),
      working_location: z.enum(WORKING_LOCATIONS).nullable(),
      job_grade_id: z.string().nullable(),
      work_email: z
        .string()
        .trim()
        .max(150)
        .refine((v) => v === '' || z.email().safeParse(v).success, t('validation.email')),
      joining_date: z.string().nullable(),
      confirmation_date: z.string().nullable(),
      probation_end_date: z.string().nullable(),
      supervisor_profile_id: z.string().nullable(),
      is_service_continuous: z.boolean(),
      nominee_name: z.string().trim().max(150),
      nominee_relation: z.enum(RELATIONS).nullable(),
      nominee_date_of_birth: z.string().nullable(),
      nominee_national_id: z
        .string()
        .trim()
        .max(30)
        .refine((v) => v === '' || ID_NUMBER.test(v), t('validation.idNumber')),
      nominee_phone: z
        .string()
        .trim()
        .max(30)
        .refine((v) => v === '' || PHONE.test(v), t('validation.phone')),
      nominee_address: z.string().trim().max(300),
      remarks: z.string().trim().max(500),
    })
    .refine((v) => !isNew || v.estate_id !== null, { path: ['estate_id'], message: t('validation.estate') })
    .refine((v) => !isNew || v.employment_type !== null, {
      path: ['employment_type'],
      message: t('validation.employmentType'),
    })
    .refine((v) => v.engagement_type !== null, {
      path: ['engagement_type'],
      message: t('validation.engagement'),
    })
    .refine((v) => v.joining_date !== null, { path: ['joining_date'], message: t('validation.joiningDate') })
    .refine((v) => isNew || v.profile_number !== '', {
      path: ['profile_number'],
      message: t('validation.profileNumberRequired'),
    })
    .refine(
      (v) =>
        v.probation_end_date === null || v.joining_date === null || v.probation_end_date >= v.joining_date,
      { path: ['probation_end_date'], message: t('validation.probationBeforeJoining') },
    );

  const form = useZodForm(schema, {
    defaultValues: {
      estate_id: profile?.estate_id ?? prefill.data?.registered_estate_id ?? null,
      employment_type: profile?.employment_type ?? initialType ?? null,
      profile_number: profile?.profile_number ?? '',
      category_id: profile?.category_id ?? null,
      engagement_type: profile?.engagement_type ?? 'permanent',
      employment_basis: profile?.employment_basis ?? null,
      job_nature: profile?.job_nature ?? null,
      working_location: profile?.working_location ?? null,
      job_grade_id: profile?.job_grade_id ?? null,
      work_email: profile?.work_email ?? '',
      joining_date: profile?.joining_date ?? null,
      confirmation_date: profile?.confirmation_date ?? null,
      probation_end_date: profile?.probation_end_date ?? null,
      supervisor_profile_id: profile?.supervisor_profile_id ?? null,
      is_service_continuous: profile?.is_service_continuous ?? true,
      nominee_name: profile?.nominee_name ?? '',
      nominee_relation: profile?.nominee_relation ?? null,
      nominee_date_of_birth: profile?.nominee_date_of_birth ?? null,
      nominee_national_id: profile?.nominee_national_id ?? '',
      nominee_phone: profile?.nominee_phone ?? '',
      nominee_address: profile?.nominee_address ?? '',
      remarks: profile?.remarks ?? '',
    },
  });
  const c = form.control;
  const bind = {
    estate_id: useFormField(c, 'estate_id'),
    employment_type: useFormField(c, 'employment_type'),
    profile_number: useFormField(c, 'profile_number'),
    category_id: useFormField(c, 'category_id'),
    engagement_type: useFormField(c, 'engagement_type'),
    employment_basis: useFormField(c, 'employment_basis'),
    job_nature: useFormField(c, 'job_nature'),
    working_location: useFormField(c, 'working_location'),
    job_grade_id: useFormField(c, 'job_grade_id'),
    work_email: useFormField(c, 'work_email'),
    joining_date: useFormField(c, 'joining_date'),
    confirmation_date: useFormField(c, 'confirmation_date'),
    probation_end_date: useFormField(c, 'probation_end_date'),
    supervisor_profile_id: useFormField(c, 'supervisor_profile_id'),
    is_service_continuous: useFormField(c, 'is_service_continuous'),
    nominee_name: useFormField(c, 'nominee_name'),
    nominee_relation: useFormField(c, 'nominee_relation'),
    nominee_date_of_birth: useFormField(c, 'nominee_date_of_birth'),
    nominee_national_id: useFormField(c, 'nominee_national_id'),
    nominee_phone: useFormField(c, 'nominee_phone'),
    nominee_address: useFormField(c, 'nominee_address'),
    remarks: useFormField(c, 'remarks'),
  };
  const readOnly = { isReadOnly: !canEdit };
  const [personError, setPersonError] = useState<string | null>(null);
  const estateId = profile?.estate_id ?? bind.estate_id.value;
  const type = profile?.employment_type ?? bind.employment_type.value;
  const colleagues = useEstateProfiles(estateId);
  const supervisors = (colleagues.data ?? [])
    .filter((other) => other.id !== profile?.id)
    .map((other) => ({ id: other.id, label: `${other.person.full_name} (${other.profile_number})` }));
  if (profile?.supervisor && !supervisors.some((option) => option.id === profile.supervisor?.id))
    supervisors.push({
      id: profile.supervisor.id,
      label: `${profile.supervisor.full_name} (${profile.supervisor.profile_number})`,
    });

  const choice = <T extends string>(
    label: string,
    list: readonly T[],
    value: T | null,
    set: (next: T | null) => void,
    name: (item: T) => string,
    options: { error?: string | undefined; isRequired?: boolean; isDisabled?: boolean } = {},
  ) => (
    <Select
      label={label}
      placeholder={t('form.select')}
      isDisabled={!canEdit || (options.isDisabled ?? false)}
      value={value ?? NONE}
      options={[
        { id: NONE, label: t('form.notRecorded') },
        ...list.map((item) => ({ id: item, label: name(item) })),
      ]}
      onChange={(next) => {
        set(pick(list, next));
      }}
      {...(options.error ? { error: options.error } : {})}
      {...(options.isRequired ? { isRequired: true } : {})}
    />
  );

  const submit = form.handleSubmit(async (v) => {
    if (isNew && person === null) {
      setPersonError(t('validation.person'));
      return;
    }
    const common = {
      category_id: v.category_id,
      engagement_type: v.engagement_type ?? 'permanent',
      employment_basis: v.employment_basis,
      job_nature: v.job_nature,
      working_location: v.working_location,
      job_grade_id: v.job_grade_id,
      work_email: blank(v.work_email),
      joining_date: v.joining_date ?? '',
      confirmation_date: v.confirmation_date,
      probation_end_date: v.probation_end_date,
      supervisor_profile_id: v.supervisor_profile_id,
      is_service_continuous: v.is_service_continuous,
      nominee_name: blank(v.nominee_name),
      nominee_relation: v.nominee_relation,
      nominee_date_of_birth: v.nominee_date_of_birth,
      nominee_national_id: blank(v.nominee_national_id),
      nominee_phone: blank(v.nominee_phone),
      nominee_address: blank(v.nominee_address),
      remarks: blank(v.remarks),
    } satisfies Omit<ProfileInput, 'profile_number'>;
    try {
      if (profile === null) {
        const number = blank(v.profile_number);
        const input: NewProfileInput = {
          ...common,
          person_id: person?.id ?? '',
          estate_id: v.estate_id ?? '',
          employment_type: v.employment_type ?? 'worker',
          ...(number ? { profile_number: number } : {}),
        };
        const made = await create.mutateAsync(input);
        toast.success(t('form.created', { name: made.person.full_name }));
        void navigate(made.employment_type === 'worker' ? '/workforce/workers' : '/workforce/employees');
      } else {
        await update.mutateAsync({ ...common, profile_number: v.profile_number.trim() });
        toast.success(t('form.saved'));
        void navigate(profile.employment_type === 'worker' ? '/workforce/workers' : '/workforce/employees');
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const duplicate = error.fieldErrors.find((d) => d.field === 'person_id');
        if (duplicate) {
          setPersonError(duplicate.message);
          return;
        }
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
    }
  });

  const grid = 'grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3';
  const assignment = profile?.current_assignment ?? null;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {!canEdit && !separated ? <PermissionNotice /> : null}
      {profile?.status === 'separated' ? (
        <Alert tone="info" title={t('form.separatedTitle')}>
          {t('form.separatedBody', {
            date: profile.separation_date ? format.date(profile.separation_date) : '',
            type: profile.separation_type ? t(`separationTypes.${profile.separation_type}`) : '',
            reason: profile.separation_reason ?? '',
          })}
        </Alert>
      ) : null}

      <Card title={t('form.sections.person')} headingLevel={2}>
        {profile ? (
          <DescriptionList
            items={[
              {
                term: t('form.person'),
                description: (
                  <Link href={`/workforce/persons/${profile.person_id}`}>{profile.person.full_name}</Link>
                ),
              },
              { term: t('form.personCode'), description: profile.person.person_code },
              { term: t('form.mobile'), description: profile.person.phone ?? t('form.notRecorded') },
            ]}
          />
        ) : initialPersonId ? (
          <p className="text-sm">{person?.label ?? '…'}</p>
        ) : (
          <AsyncCombobox
            label={t('form.person')}
            isRequired
            placeholder={t('form.personPlaceholder')}
            emptyMessage={t('form.noPerson')}
            value={person}
            onChange={(option) => {
              setPicked(option);
              setPersonError(null);
            }}
            loadOptions={({ query, cursor, signal }) => searchPersons(query, cursor, signal)}
            {...(personError ? { error: personError } : {})}
          />
        )}
        {isNew && initialPersonId && personError ? (
          <p className="mt-2 text-sm text-danger">{personError}</p>
        ) : null}
      </Card>

      <Card title={t('form.sections.employment')} headingLevel={2}>
        <div className={grid}>
          {profile ? (
            <Input
              label={t('form.estate')}
              value={`${profile.estate.code} · ${profile.estate.name}`}
              isReadOnly
            />
          ) : (
            <Select
              label={t('form.estate')}
              placeholder={t('form.select')}
              isRequired
              value={bind.estate_id.value ?? NONE}
              options={(estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              }))}
              onChange={(next) => {
                bind.estate_id.onChange(next === null || next === NONE ? null : next);
                bind.supervisor_profile_id.onChange(null);
              }}
              {...(bind.estate_id.error ? { error: bind.estate_id.error } : {})}
            />
          )}
          {profile ? (
            <Input
              label={t('form.employmentType')}
              value={t(`employmentTypes.${profile.employment_type}`)}
              isReadOnly
            />
          ) : (
            choice(
              t('form.employmentType'),
              EMPLOYMENT_TYPES,
              bind.employment_type.value,
              (next) => {
                bind.employment_type.onChange(next);
                bind.category_id.onChange(null);
              },
              (x) => t(`employmentTypes.${x}`),
              { error: bind.employment_type.error, isRequired: true },
            )
          )}
          <Input
            label={t(`form.profileNumber.${type ?? 'any'}`)}
            {...(isNew ? { placeholder: t('form.autoNumber') } : {})}
            isRequired={!isNew}
            {...bind.profile_number}
            {...readOnly}
          />
          {choice(
            t('form.engagement'),
            ENGAGEMENT_TYPES,
            bind.engagement_type.value,
            bind.engagement_type.onChange,
            (x) => t(`engagement.${x}`),
            { error: bind.engagement_type.error, isRequired: true },
          )}
          <LookupPick
            key={type ?? 'none'}
            type={type === 'employee' ? 'employee_category' : 'worker_category'}
            label={t('form.category')}
            value={bind.category_id.value}
            current={profile?.category ?? null}
            onChange={bind.category_id.onChange}
            isDisabled={!canEdit}
          />
          {choice(
            t('form.basis'),
            EMPLOYMENT_BASES,
            bind.employment_basis.value,
            bind.employment_basis.onChange,
            (x) => t(`bases.${x}`),
          )}
          {choice(t('form.jobNature'), JOB_NATURES, bind.job_nature.value, bind.job_nature.onChange, (x) =>
            t(`jobNatures.${x}`),
          )}
          {choice(
            t('form.location'),
            WORKING_LOCATIONS,
            bind.working_location.value,
            bind.working_location.onChange,
            (x) => t(`locations.${x}`),
          )}
          <LookupPick
            type="job_grade"
            label={t('form.jobGrade')}
            value={bind.job_grade_id.value}
            current={profile?.job_grade ?? null}
            onChange={bind.job_grade_id.onChange}
            isDisabled={!canEdit}
          />
          <Input
            label={t('form.workEmail')}
            type="email"
            placeholder={t('form.placeholders.email')}
            {...bind.work_email}
            {...readOnly}
          />
          <DatePicker
            label={t('form.joiningDate')}
            isRequired
            isDisabled={!canEdit}
            value={bind.joining_date.value}
            onChange={bind.joining_date.onChange}
            {...(bind.joining_date.error ? { error: bind.joining_date.error } : {})}
          />
          <DatePicker
            label={t('form.confirmationDate')}
            isDisabled={!canEdit}
            value={bind.confirmation_date.value}
            onChange={bind.confirmation_date.onChange}
          />
          <DatePicker
            label={t('form.probationEnd')}
            isDisabled={!canEdit}
            value={bind.probation_end_date.value}
            onChange={bind.probation_end_date.onChange}
            {...(bind.probation_end_date.error ? { error: bind.probation_end_date.error } : {})}
          />
          <Select
            label={t('form.reportingTo')}
            placeholder={t('form.select')}
            isDisabled={!canEdit || estateId === null}
            value={bind.supervisor_profile_id.value ?? NONE}
            options={[{ id: NONE, label: t('form.noSupervisor') }, ...supervisors]}
            onChange={(next) => {
              bind.supervisor_profile_id.onChange(next === null || next === NONE ? null : next);
            }}
          />
          <div className="flex items-end">
            <Checkbox
              isSelected={bind.is_service_continuous.value}
              isDisabled={!canEdit}
              onChange={bind.is_service_continuous.onChange}
            >
              {t('form.continuous')}
            </Checkbox>
          </div>
        </div>
      </Card>

      <Card title={t('form.sections.assignment')} headingLevel={2}>
        {assignment ? (
          <DescriptionList
            items={[
              {
                term: t('form.department'),
                description: assignment.department?.name ?? t('form.notRecorded'),
              },
              {
                term: t('form.designation'),
                description: assignment.designation?.name ?? t('form.notRecorded'),
              },
              { term: t('form.section'), description: assignment.section?.name ?? t('form.notRecorded') },
              { term: t('form.since'), description: format.date(assignment.effective_from) },
            ]}
          />
        ) : (
          <p className="text-sm text-fg-muted">{t('form.assignmentLater')}</p>
        )}
      </Card>

      <Card title={t('form.sections.nominee')} headingLevel={2}>
        <div className={grid}>
          <Input
            label={t('form.nomineeName')}
            placeholder={t('form.placeholders.nomineeName')}
            {...bind.nominee_name}
            {...readOnly}
          />
          {choice(
            t('form.nomineeRelation'),
            RELATIONS,
            bind.nominee_relation.value,
            bind.nominee_relation.onChange,
            (x) => t(`relations.${x}`),
          )}
          <DatePicker
            label={t('form.nomineeDob')}
            isDisabled={!canEdit}
            value={bind.nominee_date_of_birth.value}
            onChange={bind.nominee_date_of_birth.onChange}
          />
          <Input
            label={t('form.nomineeNid')}
            placeholder={t('form.placeholders.nid')}
            {...bind.nominee_national_id}
            {...readOnly}
          />
          <Input
            label={t('form.nomineePhone')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.nominee_phone}
            {...readOnly}
          />
          <Textarea
            label={t('form.nomineeAddress')}
            placeholder={t('form.placeholders.address')}
            rows={2}
            {...bind.nominee_address}
            {...readOnly}
          />
          <Textarea
            label={t('form.remarks')}
            placeholder={t('form.placeholders.remarks')}
            rows={2}
            maxLength={500}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.remarks}
            {...readOnly}
          />
        </div>
      </Card>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" isPending={create.isPending || update.isPending} className="w-full sm:w-auto">
            {isNew ? t('form.create') : t('form.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
