import { useState } from 'react';
import { type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useAllEstates } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, type FieldBinding, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, Card, Checkbox, DatePicker, Input, NumberInput, Select, Textarea, toast } from '@/ui';

import { checkDraft, type ContractDraft, emptyDraft, inputOf } from '../api/contractDraft';
import {
  CONTRACTOR_TYPES,
  type Contractor,
  type ContractorInput,
  LEGAL_STATUSES,
  type NewContractorInput,
  QUALITY_RATINGS,
  SAFETY_COMPLIANCE,
  useCreateContractor,
  useUpdateContractor,
} from '../api/contractors';
import { MOBILE_BANKING, RELATIONS } from '../api/schemas';
import { ContractFields } from './ContractFields';
import { LookupPick } from './LookupPick';

const NONE = 'none';
const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;
const blank = (value: string) => (value.trim() === '' ? null : value.trim());

/** The words a check can use, already in the user's language. */
interface Messages {
  readonly required: string;
  readonly phone: string;
  readonly email: string;
  readonly tooLong: (max: number) => string;
}

function makeSchema(m: Messages) {
  const text = (max: number) => z.string().trim().max(max, m.tooLong(max));
  const must = (max: number) => z.string().trim().min(1, m.required).max(max, m.tooLong(max));
  const phone = z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE.test(v), m.phone);
  const mustPhone = z
    .string()
    .trim()
    .min(1, m.required)
    .refine((v) => PHONE.test(v), m.phone);
  const date = z.string().nullable();
  return z.object({
    code: text(20),
    name: must(150),
    short_name: text(50),
    contractor_type: z.enum(CONTRACTOR_TYPES),
    trade_category_id: z
      .string()
      .nullable()
      .refine((v) => v !== null, m.required),
    legal_status: z.enum(LEGAL_STATUSES).nullable(),
    registration_type: text(100),
    contractor_since: date,
    description: text(1000),
    registered_estate_id: z.string().nullable(),
    phone: mustPhone,
    phone_alt: phone,
    email: z
      .string()
      .trim()
      .refine((v) => v === '' || z.email().safeParse(v).success, m.email),
    address_line1: must(300),
    present_district: must(100),
    present_upazila: text(100),
    present_postal_code: text(10),
    permanent_address: text(300),
    permanent_district: text(100),
    permanent_upazila: text(100),
    permanent_postal_code: text(10),
    national_id: text(30),
    registration_number: text(50),
    registration_date: date,
    renewal_date: date,
    trade_licence_number: must(50),
    trade_licence_expiry: date,
    bin: text(30),
    tin: text(30),
    vat_registration_number: text(50),
    bank_name: must(150),
    bank_branch: must(150),
    bank_account_name: must(150),
    bank_account_number: must(40),
    bank_routing_number: text(20),
    mobile_banking_provider: z.enum(MOBILE_BANKING).nullable(),
    mobile_banking_number: phone,
    equipment_owned: text(1000),
    years_of_experience: z.number().int().min(0).max(100).nullable(),
    safety_compliance: z.enum(SAFETY_COMPLIANCE).nullable(),
    quality_rating: z.enum(QUALITY_RATINGS).nullable(),
    remarks: text(500),
    emergency_contact_name: must(150),
    emergency_relation: z
      .enum(RELATIONS)
      .nullable()
      .refine((v) => v !== null, m.required),
    emergency_phone: mustPhone,
    emergency_phone_alt: phone,
    emergency_address: text(300),
    cp_name: text(150),
    cp_designation: text(100),
    cp_phone: phone,
    cp_email: z
      .string()
      .trim()
      .refine((v) => v === '' || z.email().safeParse(v).success, m.email),
  });
}
type Values = z.input<ReturnType<typeof makeSchema>>;
type FormControl = Control<Values, unknown, FieldValues>;
type TextName = { [K in keyof Values]: Values[K] extends string ? K : never }[keyof Values];
type DateName = 'contractor_since' | 'registration_date' | 'renewal_date' | 'trade_licence_expiry';
type EnumName =
  | 'contractor_type'
  | 'legal_status'
  | 'mobile_banking_provider'
  | 'safety_compliance'
  | 'quality_rating'
  | 'emergency_relation';

/** One text field of the form, connected by name. */
function TextF({
  control,
  name,
  label,
  placeholder,
  required,
  readOnly,
  type,
  area,
}: {
  readonly control: FormControl;
  readonly name: TextName;
  readonly label: string;
  readonly placeholder?: string | undefined;
  readonly required?: boolean;
  readonly readOnly: boolean;
  readonly type?: 'tel' | 'email';
  readonly area?: boolean;
}) {
  const bind = useFormField(control, name as FieldPath<Values>) as unknown as FieldBinding<string>;
  if (area)
    return (
      <Textarea
        label={label}
        rows={2}
        className="sm:col-span-2 xl:col-span-3"
        isReadOnly={readOnly}
        {...(placeholder ? { placeholder } : {})}
        {...bind}
      />
    );
  return (
    <Input
      label={label}
      isReadOnly={readOnly}
      {...(required ? { isRequired: true } : {})}
      {...(type ? { type } : {})}
      {...(placeholder ? { placeholder } : {})}
      {...bind}
    />
  );
}

function DateF({
  control,
  name,
  label,
  readOnly,
}: {
  readonly control: FormControl;
  readonly name: DateName;
  readonly label: string;
  readonly readOnly: boolean;
}) {
  const bind = useFormField(control, name) as unknown as FieldBinding<string>;
  return (
    <DatePicker
      label={label}
      isDisabled={readOnly}
      value={bind.value}
      onChange={bind.onChange}
      {...(bind.error ? { error: bind.error } : {})}
    />
  );
}

/** A pick from a fixed list, with "Not recorded" to clear it unless it is required. */
function EnumF<T extends string>({
  control,
  name,
  label,
  list,
  nameOf,
  required,
  readOnly,
  none,
  select,
}: {
  readonly control: FormControl;
  readonly name: EnumName;
  readonly label: string;
  readonly list: readonly T[];
  readonly nameOf: (item: T) => string;
  readonly required?: boolean;
  readonly readOnly: boolean;
  readonly none: string;
  readonly select: string;
}) {
  const bind = useFormField(control, name) as unknown as FieldBinding<T | null>;
  return (
    <Select
      label={label}
      placeholder={select}
      isDisabled={readOnly}
      {...(required ? { isRequired: true } : {})}
      value={bind.value ?? NONE}
      options={[
        ...(required ? [] : [{ id: NONE, label: none }]),
        ...list.map((item) => ({ id: item, label: nameOf(item) })),
      ]}
      onChange={(next) => {
        bind.onChange(list.find((item) => item === next) ?? null);
      }}
      {...(bind.error ? { error: bind.error } : {})}
    />
  );
}

/**
 * Add or change a contractor, grouped as the manager's design (Add New Contractor): basic information, contact and
 * address, the contact person and optional first contract (new only), licence and tax, bank, other information and the
 * emergency contact. The first contract is kept as a draft to be submitted for approval.
 */
export function ContractorForm({
  contractor,
  onRefused,
}: {
  readonly contractor: Contractor | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = contractor === null;
  const canEdit =
    usePermission(isNew ? 'contractor.create' : 'contractor.edit') && contractor?.status !== 'blacklisted';
  const create = useCreateContractor();
  const update = useUpdateContractor(contractor ?? { id: '', version: 0, name: '' });
  const estates = useAllEstates();
  const [withContract, setWithContract] = useState(false);
  const [contract, setContract] = useState<ContractDraft>(emptyDraft);
  const [contractErrors, setContractErrors] = useState<Record<string, string>>({});

  const schema = makeSchema({
    required: t('validation.required'),
    phone: t('validation.phone'),
    email: t('validation.email'),
    tooLong: (max) => t('validation.tooLong', { max }),
  });
  const s = (value: string | null | undefined) => value ?? '';
  const form = useZodForm(schema, {
    defaultValues: {
      code: s(contractor?.code),
      name: s(contractor?.name),
      short_name: s(contractor?.short_name),
      contractor_type: contractor?.contractor_type ?? 'company',
      trade_category_id: contractor?.trade_category_id ?? null,
      legal_status: contractor?.legal_status ?? null,
      registration_type: s(contractor?.registration_type),
      contractor_since: contractor?.contractor_since ?? null,
      description: s(contractor?.description),
      registered_estate_id: contractor?.registered_estate_id ?? null,
      phone: s(contractor?.phone),
      phone_alt: s(contractor?.phone_alt),
      email: s(contractor?.email),
      address_line1: s(contractor?.address_line1),
      present_district: s(contractor?.present_district),
      present_upazila: s(contractor?.present_upazila),
      present_postal_code: s(contractor?.present_postal_code),
      permanent_address: s(contractor?.permanent_address),
      permanent_district: s(contractor?.permanent_district),
      permanent_upazila: s(contractor?.permanent_upazila),
      permanent_postal_code: s(contractor?.permanent_postal_code),
      national_id: s(contractor?.national_id),
      registration_number: s(contractor?.registration_number),
      registration_date: contractor?.registration_date ?? null,
      renewal_date: contractor?.renewal_date ?? null,
      trade_licence_number: s(contractor?.trade_licence_number),
      trade_licence_expiry: contractor?.trade_licence_expiry ?? null,
      bin: s(contractor?.bin),
      tin: s(contractor?.tin),
      vat_registration_number: s(contractor?.vat_registration_number),
      bank_name: s(contractor?.bank_name),
      bank_branch: s(contractor?.bank_branch),
      bank_account_name: s(contractor?.bank_account_name),
      bank_account_number: s(contractor?.bank_account_number),
      bank_routing_number: s(contractor?.bank_routing_number),
      mobile_banking_provider: contractor?.mobile_banking_provider ?? null,
      mobile_banking_number: s(contractor?.mobile_banking_number),
      equipment_owned: s(contractor?.equipment_owned),
      years_of_experience: contractor?.years_of_experience ?? null,
      safety_compliance: contractor?.safety_compliance ?? null,
      quality_rating: contractor?.quality_rating ?? null,
      remarks: s(contractor?.remarks),
      emergency_contact_name: s(contractor?.emergency_contact_name),
      emergency_relation: contractor?.emergency_relation ?? null,
      emergency_phone: s(contractor?.emergency_phone),
      emergency_phone_alt: s(contractor?.emergency_phone_alt),
      emergency_address: s(contractor?.emergency_address),
      cp_name: '',
      cp_designation: '',
      cp_phone: '',
      cp_email: '',
    },
  });
  const control = form.control as unknown as FormControl;
  const ro = !canEdit;
  const yearsBind = useFormField(form.control, 'years_of_experience');
  const typeBind = useFormField(form.control, 'trade_category_id');
  const estateBind = useFormField(form.control, 'registered_estate_id');
  const enumProps = { control, readOnly: ro, none: t('form.notRecorded'), select: t('form.select') };

  const submit = form.handleSubmit(async (v) => {
    if (isNew && v.cp_name.trim() === '') {
      form.setError('cp_name', { message: t('validation.required') });
      return;
    }
    if (isNew && v.cp_phone.trim() === '') {
      form.setError('cp_phone', { message: t('validation.required') });
      return;
    }
    if (isNew && withContract) {
      const found = checkDraft(contract, {
        required: t('validation.required'),
        endBeforeStart: t('validation.endBeforeStart'),
        valueForLumpSum: t('validation.valueForLumpSum'),
        retention: t('validation.retention'),
      });
      setContractErrors(found);
      if (Object.keys(found).length > 0) return;
    }
    const input: ContractorInput = {
      name: v.name.trim(),
      short_name: blank(v.short_name),
      contractor_type: v.contractor_type,
      trade_category_id: v.trade_category_id,
      legal_status: v.legal_status,
      registration_type: blank(v.registration_type),
      contractor_since: v.contractor_since,
      description: blank(v.description),
      phone: v.phone.trim(),
      phone_alt: blank(v.phone_alt),
      email: blank(v.email),
      address_line1: v.address_line1.trim(),
      present_district: v.present_district.trim(),
      present_upazila: blank(v.present_upazila),
      present_postal_code: blank(v.present_postal_code),
      permanent_address: blank(v.permanent_address),
      permanent_district: blank(v.permanent_district),
      permanent_upazila: blank(v.permanent_upazila),
      permanent_postal_code: blank(v.permanent_postal_code),
      national_id: blank(v.national_id),
      registration_number: blank(v.registration_number),
      trade_licence_number: v.trade_licence_number.trim(),
      trade_licence_expiry: v.trade_licence_expiry,
      bin: blank(v.bin),
      tin: blank(v.tin),
      vat_registration_number: blank(v.vat_registration_number),
      registration_date: v.registration_date,
      renewal_date: v.renewal_date,
      bank_name: v.bank_name.trim(),
      bank_branch: v.bank_branch.trim(),
      bank_account_name: v.bank_account_name.trim(),
      bank_account_number: v.bank_account_number.trim(),
      bank_routing_number: blank(v.bank_routing_number),
      mobile_banking_provider: v.mobile_banking_provider,
      mobile_banking_number: blank(v.mobile_banking_number),
      equipment_owned: blank(v.equipment_owned),
      years_of_experience: v.years_of_experience,
      safety_compliance: v.safety_compliance,
      quality_rating: v.quality_rating,
      remarks: blank(v.remarks),
      emergency_contact_name: v.emergency_contact_name.trim(),
      emergency_relation: v.emergency_relation,
      emergency_phone: v.emergency_phone.trim(),
      emergency_phone_alt: blank(v.emergency_phone_alt),
      emergency_address: blank(v.emergency_address),
    };
    try {
      if (contractor === null) {
        const code = blank(v.code);
        const body: NewContractorInput = {
          ...input,
          ...(code ? { code } : {}),
          registered_estate_id: v.registered_estate_id,
          contact_person: {
            contact_name: v.cp_name.trim(),
            designation: blank(v.cp_designation),
            phone: v.cp_phone.trim(),
            email: blank(v.cp_email),
          },
          ...(withContract ? { first_contract: inputOf(contract) } : {}),
        };
        const made = await create.mutateAsync(body);
        toast.success(t('contractor.created', { name: made.name }));
        void navigate('/workforce/contractors');
      } else {
        await update.mutateAsync({ ...input, code: contractor.code });
        toast.success(t('contractor.saved'));
        void navigate('/workforce/contractors');
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const nested: Record<string, string> = {};
        const own = error.fieldErrors.flatMap((d) => {
          if (d.field?.startsWith('first_contract.')) {
            nested[d.field.slice('first_contract.'.length)] = d.message;
            return [];
          }
          const field = d.field?.startsWith('contact_person.')
            ? {
                ...d,
                field:
                  { 'contact_person.contact_name': 'cp_name', 'contact_person.phone': 'cp_phone' }[d.field] ??
                  'cp_name',
              }
            : d;
          return [field];
        });
        setContractErrors(nested);
        if (applyServerErrors(form, own).length === 0) return;
      }
      onRefused(error);
    }
  });

  const grid = 'grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3';
  const text = (
    name: TextName,
    label: string,
    options: { required?: boolean; type?: 'tel' | 'email'; area?: boolean; placeholder?: string } = {},
  ) => <TextF control={control} name={name} label={label} readOnly={ro} {...options} />;
  const date = (name: DateName, label: string) => (
    <DateF control={control} name={name} label={label} readOnly={ro} />
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {!canEdit && contractor?.status !== 'blacklisted' ? <PermissionNotice /> : null}

      <Card title={t('contractor.sections.basic')} headingLevel={2}>
        <div className={grid}>
          {isNew ? (
            text('code', t('contractor.code'), { placeholder: t('contractor.autoCode') })
          ) : (
            <Input label={t('contractor.code')} value={contractor.code} isReadOnly />
          )}
          <EnumF
            {...enumProps}
            name="contractor_type"
            label={t('contractor.type')}
            list={CONTRACTOR_TYPES}
            nameOf={(x) => t(`contractorTypes.${x}`)}
            required
          />
          <LookupPick
            type="trade_category"
            label={t('contractor.trade')}
            value={typeBind.value}
            current={contractor?.trade_category ?? null}
            isDisabled={ro}
            onChange={typeBind.onChange}
          />
          {text('name', t('contractor.name'), { required: true })}
          {text('short_name', t('contractor.shortName'))}
          <EnumF
            {...enumProps}
            name="legal_status"
            label={t('contractor.legalStatus')}
            list={LEGAL_STATUSES}
            nameOf={(x) => t(`legalStatuses.${x}`)}
          />
          {text('registration_type', t('contractor.registrationType'))}
          {date('contractor_since', t('contractor.since'))}
          {text('national_id', t('contractor.nationalId'))}
          {text('registration_number', t('contractor.registrationNumber'))}
          {date('registration_date', t('contractor.registrationDate'))}
          {date('renewal_date', t('contractor.renewalDate'))}
          {isNew ? (
            <Select
              label={t('contractor.estate')}
              placeholder={t('form.select')}
              value={estateBind.value ?? NONE}
              options={[
                { id: NONE, label: t('form.notRecorded') },
                ...(estates.data ?? []).map((estate) => ({
                  id: estate.id,
                  label: `${estate.code} · ${estate.name}`,
                })),
              ]}
              onChange={(next) => {
                estateBind.onChange(next === null || next === NONE ? null : next);
              }}
            />
          ) : null}
          {text('description', t('contractor.description'), { area: true })}
        </div>
      </Card>

      <Card title={t('contractor.sections.contact')} headingLevel={2}>
        <div className={grid}>
          {text('phone', t('contractor.phone'), {
            required: true,
            type: 'tel',
            placeholder: '+8801711000000',
          })}
          {text('phone_alt', t('contractor.phoneAlt'), { type: 'tel' })}
          {text('email', t('contractor.email'), { type: 'email' })}
          {text('address_line1', t('contractor.address'), { required: true })}
          {text('present_district', t('contractor.district'), { required: true })}
          {text('present_upazila', t('contractor.upazila'))}
          {text('present_postal_code', t('contractor.postalCode'))}
          {text('permanent_address', t('contractor.permanentAddress'))}
          {text('permanent_district', t('contractor.permanentDistrict'))}
          {text('permanent_upazila', t('contractor.permanentUpazila'))}
          {text('permanent_postal_code', t('contractor.permanentPostalCode'))}
        </div>
      </Card>

      {isNew ? (
        <Card title={t('contractor.sections.person')} headingLevel={2}>
          <div className={grid}>
            {text('cp_name', t('contractor.cpName'), { required: true })}
            {text('cp_designation', t('contractor.cpDesignation'))}
            {text('cp_phone', t('contractor.cpPhone'), { required: true, type: 'tel' })}
            {text('cp_email', t('contractor.cpEmail'), { type: 'email' })}
          </div>
          <p className="mt-2 text-sm text-fg-muted">{t('contractor.cpHint')}</p>
        </Card>
      ) : null}

      <Card title={t('contractor.sections.legal')} headingLevel={2}>
        <div className={grid}>
          {text('trade_licence_number', t('contractor.licence'), { required: true })}
          {date('trade_licence_expiry', t('contractor.licenceExpiry'))}
          {text('bin', t('contractor.bin'))}
          {text('tin', t('contractor.tin'))}
          {text('vat_registration_number', t('contractor.vat'))}
        </div>
      </Card>

      <Card title={t('contractor.sections.bank')} headingLevel={2}>
        <div className={grid}>
          {text('bank_name', t('contractor.bankName'), { required: true })}
          {text('bank_branch', t('contractor.bankBranch'), { required: true })}
          {text('bank_account_name', t('contractor.accountName'), { required: true })}
          {text('bank_account_number', t('contractor.accountNumber'), { required: true })}
          {text('bank_routing_number', t('contractor.routing'))}
          <EnumF
            {...enumProps}
            name="mobile_banking_provider"
            label={t('contractor.mobileProvider')}
            list={MOBILE_BANKING}
            nameOf={(x) => t(`mobileBanking.${x}`)}
          />
          {text('mobile_banking_number', t('contractor.mobileNumber'), { type: 'tel' })}
        </div>
      </Card>

      <Card title={t('contractor.sections.other')} headingLevel={2}>
        <div className={grid}>
          <NumberInput
            label={t('contractor.experience')}
            minValue={0}
            maxValue={100}
            formatOptions={{ maximumFractionDigits: 0 }}
            isDisabled={ro}
            value={yearsBind.value}
            onChange={yearsBind.onChange}
          />
          <EnumF
            {...enumProps}
            name="safety_compliance"
            label={t('contractor.safety')}
            list={SAFETY_COMPLIANCE}
            nameOf={(x) => t(`safetyCompliance.${x}`)}
          />
          <EnumF
            {...enumProps}
            name="quality_rating"
            label={t('contractor.quality')}
            list={QUALITY_RATINGS}
            nameOf={(x) => t(`qualityRatings.${x}`)}
          />
          {text('equipment_owned', t('contractor.equipment'), { area: true })}
          {text('remarks', t('contractor.remarks'), { area: true })}
        </div>
      </Card>

      <Card title={t('contractor.sections.emergency')} headingLevel={2}>
        <div className={grid}>
          {text('emergency_contact_name', t('contractor.emergencyName'), { required: true })}
          <EnumF
            {...enumProps}
            name="emergency_relation"
            label={t('contractor.emergencyRelation')}
            list={RELATIONS}
            nameOf={(x) => t(`relations.${x}`)}
            required
          />
          {text('emergency_phone', t('contractor.emergencyPhone'), { required: true, type: 'tel' })}
          {text('emergency_phone_alt', t('contractor.emergencyPhoneAlt'), { type: 'tel' })}
          {text('emergency_address', t('contractor.emergencyAddress'), { area: true })}
        </div>
      </Card>

      {isNew ? (
        <Card title={t('contractor.sections.contract')} headingLevel={2}>
          <div className="flex flex-col gap-3">
            <Checkbox isSelected={withContract} onChange={setWithContract}>
              {t('contractor.addContract')}
            </Checkbox>
            {withContract ? (
              <ContractFields value={contract} onChange={setContract} errors={contractErrors} />
            ) : (
              <p className="text-sm text-fg-muted">{t('contractor.contractLater')}</p>
            )}
          </div>
        </Card>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" isPending={create.isPending || update.isPending} className="w-full sm:w-auto">
            {isNew ? t('contractor.create') : t('contractor.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
