import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useAllEstates } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, Card, Checkbox, DatePicker, Input, NumberInput, Select, Textarea, toast } from '@/ui';

import { type PersonInput, useCreatePerson, useUpdatePerson } from '../api/persons';
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  MOBILE_BANKING,
  PAYMENT_METHODS,
  type Person,
  RELATIONS,
  TITLES,
} from '../api/schemas';
import { LookupMultiSelect, LookupPick } from './LookupPick';

const NONE = 'none';
const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;
const ID_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 /-]*$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const blank = (value: string) => (value.trim() === '' ? null : value.trim());
/** The member of a list that a Select's text names, or null (the "not recorded" row). */
const pick = <T extends string>(list: readonly T[], value: string | null): T | null =>
  list.find((item) => item === value) ?? null;

export interface PersonFormProps {
  /** The person being changed, or null for a new one. */
  readonly person: Person | null;
  readonly onRefused: (error: unknown) => void;
}

/**
 * Add / edit a person, grouped as the manager's design (Add New Worker / Employee): basic information, contact and
 * address, additional information (education, skills, emergency contact), payment. The employment section is the
 * employment profile's (P2.02) and shows when it arrives. Identity only: the server refuses employment fields.
 */
export function PersonForm({ person, onRefused }: PersonFormProps) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = person === null;
  const canEdit = usePermission(isNew ? 'person.create' : 'person.edit');
  const create = useCreatePerson();
  const update = useUpdatePerson(person ?? { id: '', version: 0, full_name: '' });
  const estates = useAllEstates();
  const [samePermanent, setSamePermanent] = useState(false);

  const text = (max: number) => z.string().trim().max(max, t('validation.tooLong', { max }));
  const phone = z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === '' || PHONE.test(v), t('validation.phone'));
  const idNumber = (max: number) =>
    z
      .string()
      .trim()
      .max(max, t('validation.tooLong', { max }))
      .refine((v) => v === '' || ID_NUMBER.test(v), t('validation.idNumber'));

  const schema = z
    .object({
      registered_estate_id: z.string().nullable(),
      title: z.enum(TITLES).nullable(),
      first_name: z.string().trim().min(1, t('validation.firstName')).max(100),
      middle_name: text(100),
      last_name: text(100),
      father_name: text(150),
      mother_name: text(150),
      spouse_name: text(150),
      date_of_birth: z
        .string()
        .nullable()
        .refine((v) => v === null || v <= todayIso(), t('validation.notFuture')),
      gender: z.enum(GENDERS).nullable(),
      marital_status: z.enum(MARITAL_STATUSES).nullable(),
      blood_group: z.enum(BLOOD_GROUPS).nullable(),
      nationality_country_id: z.string().nullable(),
      religion_id: z.string().nullable(),
      national_id: idNumber(30),
      birth_certificate_no: idNumber(30),
      passport_no: idNumber(30),
      driving_license_no: idNumber(30),
      tin: idNumber(30),
      phone,
      alternate_phone: phone,
      personal_email: z
        .string()
        .trim()
        .max(150)
        .refine((v) => v === '' || z.email().safeParse(v).success, t('validation.email')),
      present_address: text(300),
      present_district: text(100),
      present_upazila: text(100),
      present_postal_code: text(20),
      permanent_address: text(300),
      permanent_district: text(100),
      permanent_upazila: text(100),
      permanent_postal_code: text(20),
      education_level_id: z.string().nullable(),
      skill_ids: z.array(z.string()),
      language_ids: z.array(z.string()),
      experience_years: z.number().int().min(0).max(80).nullable(),
      emergency_contact_name: text(150),
      emergency_contact_phone: phone,
      emergency_contact_alt_phone: phone,
      emergency_contact_relation: z.enum(RELATIONS).nullable(),
      emergency_contact_address: text(300),
      payment_method: z.enum(PAYMENT_METHODS).nullable(),
      bank_name: text(150),
      bank_branch: text(150),
      bank_account_number: idNumber(40),
      mobile_banking_provider: z.enum(MOBILE_BANKING).nullable(),
      mobile_banking_number: phone,
      remarks: text(500),
    })
    .refine((v) => v.payment_method !== 'bank' || v.bank_account_number !== '', {
      path: ['bank_account_number'],
      message: t('validation.bankAccount'),
    })
    .refine((v) => v.payment_method !== 'mobile_banking' || v.mobile_banking_number !== '', {
      path: ['mobile_banking_number'],
      message: t('validation.mobileBanking'),
    })
    .refine((v) => v.payment_method !== 'mobile_banking' || v.mobile_banking_provider !== null, {
      path: ['mobile_banking_provider'],
      message: t('validation.mobileProvider'),
    });

  const form = useZodForm(schema, {
    defaultValues: {
      registered_estate_id: person?.registered_estate_id ?? null,
      title: person?.title ?? null,
      first_name: person?.first_name ?? '',
      middle_name: person?.middle_name ?? '',
      last_name: person?.last_name ?? '',
      father_name: person?.father_name ?? '',
      mother_name: person?.mother_name ?? '',
      spouse_name: person?.spouse_name ?? '',
      date_of_birth: person?.date_of_birth ?? null,
      gender: person?.gender ?? null,
      marital_status: person?.marital_status ?? null,
      blood_group: person?.blood_group ?? null,
      nationality_country_id: person?.nationality_country_id ?? null,
      religion_id: person?.religion_id ?? null,
      national_id: person?.national_id ?? '',
      birth_certificate_no: person?.birth_certificate_no ?? '',
      passport_no: person?.passport_no ?? '',
      driving_license_no: person?.driving_license_no ?? '',
      tin: person?.tin ?? '',
      phone: person?.phone ?? '',
      alternate_phone: person?.alternate_phone ?? '',
      personal_email: person?.personal_email ?? '',
      present_address: person?.present_address ?? '',
      present_district: person?.present_district ?? '',
      present_upazila: person?.present_upazila ?? '',
      present_postal_code: person?.present_postal_code ?? '',
      permanent_address: person?.permanent_address ?? '',
      permanent_district: person?.permanent_district ?? '',
      permanent_upazila: person?.permanent_upazila ?? '',
      permanent_postal_code: person?.permanent_postal_code ?? '',
      education_level_id: person?.education_level_id ?? null,
      skill_ids: person?.skills.map((s) => s.id) ?? [],
      language_ids: person?.languages.map((l) => l.id) ?? [],
      experience_years: person?.experience_years ?? null,
      emergency_contact_name: person?.emergency_contact_name ?? '',
      emergency_contact_phone: person?.emergency_contact_phone ?? '',
      emergency_contact_alt_phone: person?.emergency_contact_alt_phone ?? '',
      emergency_contact_relation: person?.emergency_contact_relation ?? null,
      emergency_contact_address: person?.emergency_contact_address ?? '',
      payment_method: person?.payment_method ?? null,
      bank_name: person?.bank_name ?? '',
      bank_branch: person?.bank_branch ?? '',
      bank_account_number: person?.bank_account_number ?? '',
      mobile_banking_provider: person?.mobile_banking_provider ?? null,
      mobile_banking_number: person?.mobile_banking_number ?? '',
      remarks: person?.remarks ?? '',
    },
  });
  const c = form.control;
  const bind = {
    registered_estate_id: useFormField(c, 'registered_estate_id'),
    title: useFormField(c, 'title'),
    first_name: useFormField(c, 'first_name'),
    middle_name: useFormField(c, 'middle_name'),
    last_name: useFormField(c, 'last_name'),
    father_name: useFormField(c, 'father_name'),
    mother_name: useFormField(c, 'mother_name'),
    spouse_name: useFormField(c, 'spouse_name'),
    date_of_birth: useFormField(c, 'date_of_birth'),
    gender: useFormField(c, 'gender'),
    marital_status: useFormField(c, 'marital_status'),
    blood_group: useFormField(c, 'blood_group'),
    nationality_country_id: useFormField(c, 'nationality_country_id'),
    religion_id: useFormField(c, 'religion_id'),
    national_id: useFormField(c, 'national_id'),
    birth_certificate_no: useFormField(c, 'birth_certificate_no'),
    passport_no: useFormField(c, 'passport_no'),
    driving_license_no: useFormField(c, 'driving_license_no'),
    tin: useFormField(c, 'tin'),
    phone: useFormField(c, 'phone'),
    alternate_phone: useFormField(c, 'alternate_phone'),
    personal_email: useFormField(c, 'personal_email'),
    present_address: useFormField(c, 'present_address'),
    present_district: useFormField(c, 'present_district'),
    present_upazila: useFormField(c, 'present_upazila'),
    present_postal_code: useFormField(c, 'present_postal_code'),
    permanent_address: useFormField(c, 'permanent_address'),
    permanent_district: useFormField(c, 'permanent_district'),
    permanent_upazila: useFormField(c, 'permanent_upazila'),
    permanent_postal_code: useFormField(c, 'permanent_postal_code'),
    education_level_id: useFormField(c, 'education_level_id'),
    skill_ids: useFormField(c, 'skill_ids'),
    language_ids: useFormField(c, 'language_ids'),
    experience_years: useFormField(c, 'experience_years'),
    emergency_contact_name: useFormField(c, 'emergency_contact_name'),
    emergency_contact_phone: useFormField(c, 'emergency_contact_phone'),
    emergency_contact_alt_phone: useFormField(c, 'emergency_contact_alt_phone'),
    emergency_contact_relation: useFormField(c, 'emergency_contact_relation'),
    emergency_contact_address: useFormField(c, 'emergency_contact_address'),
    payment_method: useFormField(c, 'payment_method'),
    bank_name: useFormField(c, 'bank_name'),
    bank_branch: useFormField(c, 'bank_branch'),
    bank_account_number: useFormField(c, 'bank_account_number'),
    mobile_banking_provider: useFormField(c, 'mobile_banking_provider'),
    mobile_banking_number: useFormField(c, 'mobile_banking_number'),
    remarks: useFormField(c, 'remarks'),
  };
  const readOnly = { isReadOnly: !canEdit };

  /** "Same as present address": copies the four present-address fields over the permanent ones. */
  const copyAddress = (same: boolean) => {
    setSamePermanent(same);
    if (!same) return;
    bind.permanent_address.onChange(bind.present_address.value);
    bind.permanent_district.onChange(bind.present_district.value);
    bind.permanent_upazila.onChange(bind.present_upazila.value);
    bind.permanent_postal_code.onChange(bind.present_postal_code.value);
  };

  /** A Select over a short fixed list, with a "Not recorded" row to clear it. */
  const choice = <T extends string>(
    label: string,
    list: readonly T[],
    value: T | null,
    set: (next: T | null) => void,
    name: (item: T) => string,
    error?: string,
    isRequired?: boolean,
  ) => (
    <Select
      label={label}
      placeholder={t('person.select')}
      isDisabled={!canEdit}
      value={value ?? NONE}
      options={[
        { id: NONE, label: t('person.notRecorded') },
        ...list.map((item) => ({ id: item, label: name(item) })),
      ]}
      onChange={(next) => {
        set(pick(list, next));
      }}
      {...(error ? { error } : {})}
      {...(isRequired ? { isRequired } : {})}
    />
  );

  const submit = form.handleSubmit(async (v) => {
    const input: PersonInput = {
      registered_estate_id: v.registered_estate_id,
      title: v.title,
      first_name: v.first_name.trim(),
      middle_name: blank(v.middle_name),
      last_name: blank(v.last_name),
      father_name: blank(v.father_name),
      mother_name: blank(v.mother_name),
      spouse_name: blank(v.spouse_name),
      date_of_birth: v.date_of_birth,
      gender: v.gender,
      marital_status: v.marital_status,
      blood_group: v.blood_group,
      nationality_country_id: v.nationality_country_id,
      religion_id: v.religion_id,
      national_id: blank(v.national_id),
      birth_certificate_no: blank(v.birth_certificate_no),
      passport_no: blank(v.passport_no),
      driving_license_no: blank(v.driving_license_no),
      tin: blank(v.tin),
      phone: blank(v.phone),
      alternate_phone: blank(v.alternate_phone),
      personal_email: blank(v.personal_email),
      present_address: blank(v.present_address),
      present_district: blank(v.present_district),
      present_upazila: blank(v.present_upazila),
      present_postal_code: blank(v.present_postal_code),
      permanent_address: blank(v.permanent_address),
      permanent_district: blank(v.permanent_district),
      permanent_upazila: blank(v.permanent_upazila),
      permanent_postal_code: blank(v.permanent_postal_code),
      education_level_id: v.education_level_id,
      skill_ids: v.skill_ids,
      language_ids: v.language_ids,
      experience_years: v.experience_years,
      emergency_contact_name: blank(v.emergency_contact_name),
      emergency_contact_phone: blank(v.emergency_contact_phone),
      emergency_contact_alt_phone: blank(v.emergency_contact_alt_phone),
      emergency_contact_relation: v.emergency_contact_relation,
      emergency_contact_address: blank(v.emergency_contact_address),
      payment_method: v.payment_method,
      bank_name: blank(v.bank_name),
      bank_branch: blank(v.bank_branch),
      bank_account_number: blank(v.bank_account_number),
      mobile_banking_provider: v.mobile_banking_provider,
      mobile_banking_number: blank(v.mobile_banking_number),
      remarks: blank(v.remarks),
    };
    try {
      if (isNew) {
        const made = await create.mutateAsync(input);
        toast.success(t('person.created', { name: made.full_name }));
        void navigate('/workforce/persons');
      } else {
        await update.mutateAsync(input);
        toast.success(t('person.saved'));
        void navigate('/workforce/persons');
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
    }
  });

  const grid = 'grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3';
  const mobileBank = bind.payment_method.value === 'mobile_banking';
  const bank = bind.payment_method.value === 'bank';

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {!canEdit ? <PermissionNotice /> : null}

      <Card title={t('person.sections.basic')} headingLevel={2}>
        <div className={grid}>
          {person ? (
            <Input label={t('person.code')} value={person.person_code} isReadOnly />
          ) : (
            <Input label={t('person.code')} value="" placeholder={t('person.autoCode')} isReadOnly />
          )}
          {choice(t('person.title'), TITLES, bind.title.value, bind.title.onChange, (x) => t(`titles.${x}`))}
          <Input
            label={t('person.firstName')}
            placeholder={t('person.placeholders.firstName')}
            isRequired
            {...bind.first_name}
            {...readOnly}
          />
          <Input
            label={t('person.middleName')}
            placeholder={t('person.placeholders.middleName')}
            {...bind.middle_name}
            {...readOnly}
          />
          <Input
            label={t('person.lastName')}
            placeholder={t('person.placeholders.lastName')}
            {...bind.last_name}
            {...readOnly}
          />
          <Input
            label={t('person.fatherName')}
            placeholder={t('person.placeholders.fatherName')}
            {...bind.father_name}
            {...readOnly}
          />
          <Input
            label={t('person.motherName')}
            placeholder={t('person.placeholders.motherName')}
            {...bind.mother_name}
            {...readOnly}
          />
          <Input
            label={t('person.spouseName')}
            placeholder={t('person.placeholders.spouseName')}
            {...bind.spouse_name}
            {...readOnly}
          />
          <DatePicker
            label={t('person.dateOfBirth')}
            value={bind.date_of_birth.value}
            onChange={bind.date_of_birth.onChange}
            isDisabled={!canEdit}
            {...(bind.date_of_birth.error ? { error: bind.date_of_birth.error } : {})}
          />
          {choice(t('person.gender'), GENDERS, bind.gender.value, bind.gender.onChange, (x) =>
            t(`genders.${x}`),
          )}
          {choice(
            t('person.bloodGroup'),
            BLOOD_GROUPS,
            bind.blood_group.value,
            bind.blood_group.onChange,
            (x) => x,
          )}
          {choice(
            t('person.maritalStatus'),
            MARITAL_STATUSES,
            bind.marital_status.value,
            bind.marital_status.onChange,
            (x) => t(`maritalStatuses.${x}`),
          )}
          <LookupPick
            type="country"
            label={t('person.nationality')}
            value={bind.nationality_country_id.value}
            current={person?.nationality ?? null}
            onChange={bind.nationality_country_id.onChange}
            isDisabled={!canEdit}
          />
          <LookupPick
            type="religion"
            label={t('person.religion')}
            value={bind.religion_id.value}
            current={person?.religion ?? null}
            onChange={bind.religion_id.onChange}
            isDisabled={!canEdit}
          />
          <Input
            label={t('person.nationalId')}
            placeholder={t('person.placeholders.nationalId')}
            {...bind.national_id}
            {...readOnly}
          />
          <Input
            label={t('person.birthCertificate')}
            placeholder={t('person.placeholders.birthCertificate')}
            {...bind.birth_certificate_no}
            {...readOnly}
          />
          <Input
            label={t('person.passport')}
            placeholder={t('person.placeholders.passport')}
            {...bind.passport_no}
            {...readOnly}
          />
          <Input
            label={t('person.drivingLicense')}
            placeholder={t('person.placeholders.drivingLicense')}
            {...bind.driving_license_no}
            {...readOnly}
          />
          <Input
            label={t('person.tin')}
            placeholder={t('person.placeholders.tin')}
            {...bind.tin}
            {...readOnly}
          />
          <Select
            label={t('person.estate')}
            placeholder={t('person.select')}
            isDisabled={!canEdit}
            value={bind.registered_estate_id.value ?? NONE}
            options={[
              { id: NONE, label: t('person.notRecorded') },
              ...(estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            ]}
            onChange={(next) => {
              bind.registered_estate_id.onChange(next === null || next === NONE ? null : next);
            }}
            {...(bind.registered_estate_id.error ? { error: bind.registered_estate_id.error } : {})}
          />
        </div>
      </Card>

      <Card title={t('person.sections.contact')} headingLevel={2}>
        <div className={grid}>
          <Input
            label={t('person.phone')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.phone}
            {...readOnly}
          />
          <Input
            label={t('person.alternatePhone')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.alternate_phone}
            {...readOnly}
          />
          <Input
            label={t('person.personalEmail')}
            type="email"
            placeholder={t('person.placeholders.email')}
            {...bind.personal_email}
            {...readOnly}
          />
          <Textarea
            label={t('person.presentAddress')}
            placeholder={t('person.placeholders.address')}
            rows={2}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.present_address}
            {...readOnly}
          />
          <Input
            label={t('person.district')}
            placeholder={t('person.placeholders.district')}
            {...bind.present_district}
            {...readOnly}
          />
          <Input
            label={t('person.upazila')}
            placeholder={t('person.placeholders.upazila')}
            {...bind.present_upazila}
            {...readOnly}
          />
          <Input
            label={t('person.postalCode')}
            placeholder="3210"
            {...bind.present_postal_code}
            {...readOnly}
          />
          <div className="flex items-end sm:col-span-2 xl:col-span-3">
            <Checkbox isSelected={samePermanent} isDisabled={!canEdit} onChange={copyAddress}>
              {t('person.samePermanent')}
            </Checkbox>
          </div>
          <Textarea
            label={t('person.permanentAddress')}
            placeholder={t('person.placeholders.address')}
            rows={2}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.permanent_address}
            {...readOnly}
          />
          <Input
            label={t('person.district')}
            placeholder={t('person.placeholders.district')}
            {...bind.permanent_district}
            {...readOnly}
          />
          <Input
            label={t('person.upazila')}
            placeholder={t('person.placeholders.upazila')}
            {...bind.permanent_upazila}
            {...readOnly}
          />
          <Input
            label={t('person.postalCode')}
            placeholder="3210"
            {...bind.permanent_postal_code}
            {...readOnly}
          />
        </div>
      </Card>

      <Card title={t('person.sections.additional')} headingLevel={2}>
        <div className={grid}>
          <LookupPick
            type="education_level"
            label={t('person.education')}
            value={bind.education_level_id.value}
            current={person?.education_level ?? null}
            onChange={bind.education_level_id.onChange}
            isDisabled={!canEdit}
          />
          <NumberInput
            label={t('person.experience')}
            placeholder="5"
            minValue={0}
            maxValue={80}
            formatOptions={{ maximumFractionDigits: 0 }}
            value={bind.experience_years.value}
            onChange={bind.experience_years.onChange}
            isDisabled={!canEdit}
            {...(bind.experience_years.error ? { error: bind.experience_years.error } : {})}
          />
          <span className="hidden xl:block" />
          <LookupMultiSelect
            type="skill"
            label={t('person.skills')}
            value={bind.skill_ids.value}
            current={person?.skills ?? []}
            onChange={bind.skill_ids.onChange}
            isDisabled={!canEdit}
          />
          <LookupMultiSelect
            type="language"
            label={t('person.languages')}
            value={bind.language_ids.value}
            current={person?.languages ?? []}
            onChange={bind.language_ids.onChange}
            isDisabled={!canEdit}
          />
          <span className="hidden xl:block" />
          <Input
            label={t('person.emergencyName')}
            placeholder={t('person.placeholders.emergencyName')}
            {...bind.emergency_contact_name}
            {...readOnly}
          />
          <Input
            label={t('person.emergencyPhone')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.emergency_contact_phone}
            {...readOnly}
          />
          {choice(
            t('person.emergencyRelation'),
            RELATIONS,
            bind.emergency_contact_relation.value,
            bind.emergency_contact_relation.onChange,
            (x) => t(`relations.${x}`),
          )}
          <Input
            label={t('person.emergencyAltPhone')}
            type="tel"
            placeholder="+8801711000000"
            {...bind.emergency_contact_alt_phone}
            {...readOnly}
          />
          <Textarea
            label={t('person.emergencyAddress')}
            placeholder={t('person.placeholders.address')}
            rows={2}
            className="sm:col-span-1 xl:col-span-2"
            {...bind.emergency_contact_address}
            {...readOnly}
          />
        </div>
      </Card>

      <Card title={t('person.sections.payment')} headingLevel={2}>
        <div className={grid}>
          {choice(
            t('person.paymentMethod'),
            PAYMENT_METHODS,
            bind.payment_method.value,
            bind.payment_method.onChange,
            (x) => t(`paymentMethods.${x}`),
          )}
          {bank ? (
            <>
              <Input
                label={t('person.bankName')}
                placeholder={t('person.placeholders.bankName')}
                {...bind.bank_name}
                {...readOnly}
              />
              <Input
                label={t('person.bankBranch')}
                placeholder={t('person.placeholders.bankBranch')}
                {...bind.bank_branch}
                {...readOnly}
              />
              <Input
                label={t('person.bankAccount')}
                placeholder={t('person.placeholders.bankAccount')}
                isRequired
                {...bind.bank_account_number}
                {...readOnly}
              />
            </>
          ) : null}
          {mobileBank ? (
            <>
              {choice(
                t('person.mobileProvider'),
                MOBILE_BANKING,
                bind.mobile_banking_provider.value,
                bind.mobile_banking_provider.onChange,
                (x) => t(`mobileBanking.${x}`),
                bind.mobile_banking_provider.error,
                true,
              )}
              <Input
                label={t('person.mobileNumber')}
                type="tel"
                placeholder="+8801711000000"
                isRequired
                {...bind.mobile_banking_number}
                {...readOnly}
              />
            </>
          ) : null}
          <Textarea
            label={t('person.remarks')}
            placeholder={t('person.placeholders.remarks')}
            rows={2}
            maxLength={500}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.remarks}
            {...readOnly}
          />
        </div>
      </Card>

      <Card title={t('person.sections.employment')} headingLevel={2}>
        <p className="text-sm text-fg-muted">{t('person.employmentLater')}</p>
      </Card>

      {canEdit ? (
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onPress={() => {
              form.reset();
              setSamePermanent(false);
            }}
          >
            {t('person.reset')}
          </Button>
          <Button type="submit" isPending={create.isPending || update.isPending} className="w-full sm:w-auto">
            {isNew ? t('person.create') : t('person.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
