import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { AttachmentsPanel } from '@/features/documents';
import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, type FieldBinding, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { lookupLabel, lookupOption, lookupText, useActiveLookups } from '@/lib/lookups';
import { Dec } from '@/lib/money';
import {
  Button,
  Card,
  Checkbox,
  Input,
  LazyGeoMap,
  NumberInput,
  PageHeader,
  Select,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import {
  type EstateContact,
  KEY_PEOPLE,
  type KeyPerson,
  type KeyPersonInput,
  useEstateContacts,
  useEstateSummary,
  useRemoveKeyPerson,
  useSaveKeyPerson,
} from '../api/estateProfile';
import { type EstateInput, useCreateEstate, useEstate, useUpdateEstate } from '../api/hierarchy';
import { ESTATE_CATEGORIES, ESTATE_TYPES, type Estate, NODE_CODE, PHONE } from '../api/schemas';
import { EstateOverview } from '../components/EstateOverview';
import { EstateSummary } from '../components/EstateSummary';
import { EstatePhotos } from '../components/EstatePhotos';
import { EstateTabs } from '../components/EstateTabs';
import { NodeLifecycle } from '../components/NodeLifecycle';

/** Stands for "not recorded" in a Select, whose options need an id. */
const NONE = 'none';
const COORDINATE = /^-?\d{1,3}(\.\d{1,6})?$/;
const WEBSITE = /^https?:\/\/\S+\.\S+$/i;

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());
const thisYear = () => new Date().getFullYear();

interface PersonValues {
  contact_name: string;
  designation: string;
  phone: string;
  email: string;
}
const emptyPerson: PersonValues = { contact_name: '', designation: '', phone: '', email: '' };
const isBlank = (person: PersonValues) =>
  [person.contact_name, person.designation, person.phone, person.email].every((value) => value.trim() === '');
const personOf = (contact: EstateContact | null): PersonValues =>
  contact
    ? {
        contact_name: contact.contact_name,
        designation: contact.designation ?? '',
        phone: contact.phone ?? '',
        email: contact.email ?? '',
      }
    : emptyPerson;
const personInput = (person: PersonValues): KeyPersonInput => ({
  contact_name: person.contact_name.trim(),
  designation: blankToNull(person.designation),
  phone: blankToNull(person.phone),
  email: blankToNull(person.email),
});

/** The active Estate Manager and Assistant Manager among the estate's contacts. */
function keyPeople(contacts: readonly EstateContact[]): Record<KeyPerson, EstateContact | null> {
  const find = (role: KeyPerson) =>
    contacts.find((c) => c.contact_type === role && c.status === 'active') ?? null;
  return { estate_manager: find('estate_manager'), assistant_manager: find('assistant_manager') };
}

/** Estate Management → Estate Profile (R.2): /estates/:id, or a new estate at /estates/new. */
export function EstatePage() {
  const { id } = useParams();
  if (id === undefined) return <EstateProfile estate={null} contacts={[]} />;
  return <ExistingEstate id={id} />;
}

function ExistingEstate({ id }: { readonly id: string }) {
  const estate = useEstate(id);
  const contacts = useEstateContacts(id);
  if (estate.isPending || contacts.isPending) return <PageLoading />;
  if (estate.isError) return <PageError error={estate.error} onRetry={() => void estate.refetch()} />;
  if (contacts.isError) return <PageError error={contacts.error} onRetry={() => void contacts.refetch()} />;
  const people = keyPeople(contacts.data);
  return (
    <EstateProfile
      // A fresh form whenever the estate or its key people change on the server.
      key={[estate.data.version, people.estate_manager?.version, people.assistant_manager?.version].join('-')}
      estate={estate.data}
      contacts={contacts.data}
    />
  );
}

function EstateProfile({
  estate,
  contacts,
}: {
  readonly estate: Estate | null;
  readonly contacts: readonly EstateContact[];
}) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const isNew = estate === null;
  const canEdit = usePermission(isNew ? 'estate.create' : 'estate.edit');
  const canEditExisting = usePermission('estate.edit');
  const canDelete = usePermission('estate.delete');
  const canReadLookups = usePermission('lookup.view');
  const create = useCreateEstate();
  const update = useUpdateEstate(estate ?? { id: '', version: 0, name: '' });
  const savePerson = useSaveKeyPerson(estate?.id ?? '');
  const removePerson = useRemoveKeyPerson(estate?.id ?? '');
  const summary = useEstateSummary(estate?.id ?? '');
  const countries = useActiveLookups('country', canReadLookups);
  const amenityRows = useActiveLookups('amenity', canReadLookups);
  const [refusal, setRefusal] = useState<unknown>(null);
  const people = keyPeople(contacts);

  const person = z.object({
    contact_name: z.string().trim().max(150),
    designation: z.string().trim().max(100),
    phone: z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]),
    email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
  });
  const schema = z
    .object({
      code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
      name: z
        .string()
        .trim()
        .min(1, t('validation.required', { field: t('estate.name').toLowerCase() }))
        .max(150),
      established_year: z
        .number()
        .int(t('profile.yearRange', { max: thisYear() }))
        .min(1800, t('profile.yearRange', { max: thisYear() }))
        .max(thisYear(), t('profile.yearRange', { max: thisYear() }))
        .nullable(),
      owner_name: z.string().trim().max(150),
      estate_type: z.string(),
      estate_category: z.string(),
      address_line1: z.string().trim().max(200),
      police_station: z.string().trim().max(100),
      district: z.string().trim().max(100),
      admin_division: z.string().trim().max(100),
      country_id: z.string(),
      postal_code: z.string().trim().max(20),
      phone: z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]),
      email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
      website: z.union([
        z.literal(''),
        z.string().trim().max(150).regex(WEBSITE, t('profile.websiteFormat')),
      ]),
      total_area: z.string().nullable(),
      tea_area: z.string().nullable(),
      non_tea_area: z.string().nullable(),
      division_count: z.number().int().min(0).nullable(),
      section_count: z.number().int().min(0).nullable(),
      field_count: z.number().int().min(0).nullable(),
      worker_count: z.number().int().min(0).nullable(),
      family_count: z.number().int().min(0).nullable(),
      amenity_ids: z.array(z.string()),
      other_amenities: z.string().trim().max(300),
      latitude: z.string().trim(),
      longitude: z.string().trim(),
      description: z.string().trim().max(4000),
      people: z.object({ estate_manager: person, assistant_manager: person }),
    })
    .superRefine((values, ctx) => {
      const issue = (path: (string | number)[], message: string) => {
        ctx.addIssue({ code: 'custom', path, message });
      };
      for (const [key, limit, range] of [
        ['latitude', 90, 'profile.latitudeRange'],
        ['longitude', 180, 'profile.longitudeRange'],
      ] as const) {
        const value = values[key];
        if (value === '') continue;
        if (!COORDINATE.test(value)) issue([key], t('profile.coordinateFormat'));
        else if (new Dec(value).abs().gt(limit)) issue([key], t(range));
      }
      if ((values.latitude === '') !== (values.longitude === ''))
        issue([values.latitude === '' ? 'latitude' : 'longitude'], t('profile.bothCoordinates'));
      const { total_area: total, tea_area: tea, non_tea_area: nonTea } = values;
      if (total !== null && total !== '') {
        if (tea !== null && tea !== '' && new Dec(tea).gt(total))
          issue(['tea_area'], t('profile.overviewErrors.overTotal'));
        if (nonTea !== null && nonTea !== '' && new Dec(nonTea).gt(total))
          issue(['non_tea_area'], t('profile.overviewErrors.overTotal'));
        if (
          tea !== null &&
          tea !== '' &&
          nonTea !== null &&
          nonTea !== '' &&
          new Dec(tea).plus(nonTea).gt(total)
        )
          issue(['non_tea_area'], t('profile.overviewErrors.together'));
      }
      for (const role of KEY_PEOPLE) {
        const p = values.people[role];
        if (!isBlank(p) && p.contact_name.trim() === '')
          issue(['people', role, 'contact_name'], t('profile.contactNameRequired'));
      }
    });

  const defaults = {
    code: estate?.code ?? '',
    name: estate?.name ?? '',
    established_year: estate?.established_year ?? null,
    owner_name: estate?.owner_name ?? '',
    estate_type: estate?.estate_type ?? NONE,
    estate_category: estate?.estate_category ?? NONE,
    address_line1: estate?.address_line1 ?? '',
    police_station: estate?.police_station ?? '',
    district: estate?.district ?? '',
    admin_division: estate?.admin_division ?? '',
    country_id: estate?.country_id ?? '',
    postal_code: estate?.postal_code ?? '',
    phone: estate?.phone ?? '',
    email: estate?.email ?? '',
    website: estate?.website ?? '',
    total_area: estate?.total_area ?? null,
    tea_area: estate?.tea_area ?? null,
    non_tea_area: estate?.non_tea_area ?? null,
    division_count: estate?.division_count ?? null,
    section_count: estate?.section_count ?? null,
    field_count: estate?.field_count ?? null,
    worker_count: estate?.worker_count ?? null,
    family_count: estate?.family_count ?? null,
    amenity_ids: (estate?.amenities ?? []).map((a) => a.id),
    other_amenities: estate?.other_amenities ?? '',
    latitude: estate?.latitude ?? '',
    longitude: estate?.longitude ?? '',
    description: estate?.description ?? '',
    people: {
      estate_manager: personOf(people.estate_manager),
      assistant_manager: personOf(people.assistant_manager),
    },
  };
  const form = useZodForm(schema, { defaultValues: defaults });
  const bind = {
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    established_year: useFormField(form.control, 'established_year'),
    owner_name: useFormField(form.control, 'owner_name'),
    estate_type: useFormField(form.control, 'estate_type'),
    estate_category: useFormField(form.control, 'estate_category'),
    address_line1: useFormField(form.control, 'address_line1'),
    police_station: useFormField(form.control, 'police_station'),
    district: useFormField(form.control, 'district'),
    admin_division: useFormField(form.control, 'admin_division'),
    country_id: useFormField(form.control, 'country_id'),
    postal_code: useFormField(form.control, 'postal_code'),
    phone: useFormField(form.control, 'phone'),
    email: useFormField(form.control, 'email'),
    website: useFormField(form.control, 'website'),
    total_area: useFormField(form.control, 'total_area'),
    tea_area: useFormField(form.control, 'tea_area'),
    non_tea_area: useFormField(form.control, 'non_tea_area'),
    division_count: useFormField(form.control, 'division_count'),
    section_count: useFormField(form.control, 'section_count'),
    field_count: useFormField(form.control, 'field_count'),
    worker_count: useFormField(form.control, 'worker_count'),
    family_count: useFormField(form.control, 'family_count'),
    amenity_ids: useFormField(form.control, 'amenity_ids'),
    other_amenities: useFormField(form.control, 'other_amenities'),
    latitude: useFormField(form.control, 'latitude'),
    longitude: useFormField(form.control, 'longitude'),
    description: useFormField(form.control, 'description'),
  };
  const personBind = {
    estate_manager: {
      contact_name: useFormField(form.control, 'people.estate_manager.contact_name'),
      designation: useFormField(form.control, 'people.estate_manager.designation'),
      phone: useFormField(form.control, 'people.estate_manager.phone'),
      email: useFormField(form.control, 'people.estate_manager.email'),
    },
    assistant_manager: {
      contact_name: useFormField(form.control, 'people.assistant_manager.contact_name'),
      designation: useFormField(form.control, 'people.assistant_manager.designation'),
      phone: useFormField(form.control, 'people.assistant_manager.phone'),
      email: useFormField(form.control, 'people.assistant_manager.email'),
    },
  };
  const readOnly = { isReadOnly: !canEdit };
  const [latitude, longitude] = useWatch({ control: form.control, name: ['latitude', 'longitude'] });
  const point =
    COORDINATE.test(latitude) && COORDINATE.test(longitude)
      ? { lat: new Dec(latitude).toNumber(), lng: new Dec(longitude).toNumber() }
      : null;

  const submit = form.handleSubmit(async (values) => {
    const input: EstateInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      address_line1: blankToNull(values.address_line1),
      district: blankToNull(values.district),
      total_area: values.total_area,
      tea_area: blankToNull(values.tea_area ?? ''),
      non_tea_area: blankToNull(values.non_tea_area ?? ''),
      division_count: values.division_count,
      section_count: values.section_count,
      field_count: values.field_count,
      worker_count: values.worker_count,
      family_count: values.family_count,
      phone: blankToNull(values.phone),
      email: blankToNull(values.email),
      established_year: values.established_year,
      owner_name: blankToNull(values.owner_name),
      estate_type: ESTATE_TYPES.find((type) => type === values.estate_type) ?? null,
      estate_category: ESTATE_CATEGORIES.find((category) => category === values.estate_category) ?? null,
      police_station: blankToNull(values.police_station),
      admin_division: blankToNull(values.admin_division),
      country_id: values.country_id === '' ? null : values.country_id,
      postal_code: blankToNull(values.postal_code),
      website: blankToNull(values.website),
      latitude: blankToNull(values.latitude),
      longitude: blankToNull(values.longitude),
      description: blankToNull(values.description),
      amenity_ids: values.amenity_ids,
      other_amenities: blankToNull(values.other_amenities),
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(input);
        toast.success(t('estate.created', { name: created.name }));
        void navigate(`/estates/${created.id}`, { replace: true });
        return;
      }
      await update.mutateAsync(input);
      // Then the key people that changed: each its own request, so a refusal names the person.
      for (const role of KEY_PEOPLE) {
        const before = people[role];
        const now = values.people[role];
        const unchanged = JSON.stringify(personOf(before)) === JSON.stringify({ ...now });
        if (unchanged) continue;
        try {
          if (isBlank(now)) {
            if (before) await removePerson.mutateAsync(before);
          } else await savePerson.mutateAsync({ role, existing: before, input: personInput(now) });
        } catch (error) {
          if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
            const details = error.fieldErrors.map((d) => ({
              ...d,
              field: `people.${role}.${d.field ?? ''}`,
            }));
            if (applyServerErrors(form, details).length === 0) return;
          }
          throw error;
        }
      }
      toast.success(t('profile.saved'));
      void navigate('/estates');
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        // amenity_ids.0 and the like belong to the facilities list.
        const details = error.fieldErrors.map((d) =>
          d.field?.startsWith('amenity_ids') ? { ...d, field: 'amenity_ids' } : d,
        );
        if (applyServerErrors(form, details).length === 0) return;
      }
      setRefusal(error);
    }
  });

  const title = estate ? estate.name : t('estate.newTitle');
  const lifecycleText = estate
    ? {
        deactivateTitle: t('estate.deactivateTitle', { name: estate.name }),
        deactivateBody: t('estate.deactivateBody'),
        reactivateTitle: t('estate.reactivateTitle', { name: estate.name }),
        reactivateBody: t('estate.reactivateBody'),
        deleteTitle: t('estate.deleteTitle', { name: estate.name }),
        deleteBody: t('estate.deleteBody'),
        deactivated: t('estate.deactivated', { name: estate.name }),
        reactivated: t('estate.reactivated', { name: estate.name }),
        deleted: t('estate.deleted', { name: estate.name }),
      }
    : null;

  const select = (
    name: 'estate_type' | 'estate_category',
    label: string,
    placeholder: string,
    values: readonly string[],
    labelOf: (value: string) => string,
  ) => (
    <Select
      label={label}
      placeholder={placeholder}
      isDisabled={!canEdit}
      value={bind[name].value === NONE ? null : bind[name].value}
      onChange={(value) => {
        if (value) bind[name].onChange(value);
      }}
      options={[
        { id: NONE, label: t('profile.notRecorded') },
        ...values.map((value) => ({ id: value, label: labelOf(value) })),
      ]}
    />
  );

  // The facility list, plus any the estate has that the list no longer offers (or that the user cannot read).
  const amenityOptions = [
    ...(amenityRows.data ?? []).map((row) => ({
      id: row.id,
      label: lookupText(row, 'name') || lookupLabel(row),
    })),
    ...(estate?.amenities ?? [])
      .filter((a) => !(amenityRows.data ?? []).some((row) => row.id === a.id))
      .map((a) => ({ id: a.id, label: a.name })),
  ];
  const countryOptions = (countries.data ?? []).map(lookupOption);
  const hasFactory = (summary.data?.factory_count ?? 0) > 0;

  const basic = (
    <Card title={t('profile.basic')} headingLevel={2}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
        <Input
          label={t('estate.name')}
          placeholder={t('profile.placeholders.name')}
          isRequired
          autoComplete="off"
          {...bind.name}
          {...readOnly}
        />
        <Input
          label={t('estate.code')}
          placeholder={t('profile.placeholders.code')}
          isRequired
          autoComplete="off"
          {...bind.code}
          {...readOnly}
        />
        <NumberInput
          label={t('profile.establishedYear')}
          placeholder={t('profile.placeholders.year')}
          formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
          minValue={1800}
          maxValue={thisYear()}
          {...bind.established_year}
          {...readOnly}
        />
        <Input
          label={t('profile.ownerName')}
          placeholder={t('profile.placeholders.owner')}
          {...bind.owner_name}
          {...readOnly}
        />
        {select('estate_type', t('profile.estateType'), t('profile.placeholders.type'), ESTATE_TYPES, (v) =>
          t(`profile.types.${v as (typeof ESTATE_TYPES)[number]}`),
        )}
        {select(
          'estate_category',
          t('profile.estateCategory'),
          t('profile.placeholders.category'),
          ESTATE_CATEGORIES,
          (v) => t(`profile.categories.${v as (typeof ESTATE_CATEGORIES)[number]}`),
        )}
        <Input
          label={t('profile.address')}
          placeholder={t('profile.placeholders.address')}
          {...bind.address_line1}
          {...readOnly}
        />
        <Input
          label={t('profile.policeStation')}
          placeholder={t('profile.placeholders.police')}
          {...bind.police_station}
          {...readOnly}
        />
        <Input
          label={t('profile.district')}
          placeholder={t('profile.placeholders.district')}
          {...bind.district}
          {...readOnly}
        />
        <Input
          label={t('profile.adminDivision')}
          placeholder={t('profile.placeholders.division')}
          {...bind.admin_division}
          {...readOnly}
        />
        <Select
          label={t('profile.country')}
          placeholder={t('profile.placeholders.country')}
          isDisabled={!canEdit}
          value={bind.country_id.value === '' ? null : bind.country_id.value}
          onChange={(value) => {
            bind.country_id.onChange(value === null || value === NONE ? '' : value);
          }}
          options={[
            { id: NONE, label: t('profile.notRecorded') },
            ...(estate?.country_id && !countryOptions.some((o) => o.id === estate.country_id)
              ? [{ id: estate.country_id, label: `#${estate.country_id}` }]
              : []),
            ...countryOptions,
          ]}
        />
        <Input
          label={t('profile.postalCode')}
          placeholder={t('profile.placeholders.zip')}
          {...bind.postal_code}
          {...readOnly}
        />
        <Input
          label={t('profile.phone')}
          placeholder={t('profile.placeholders.phone')}
          type="tel"
          {...bind.phone}
          {...readOnly}
        />
        <Input
          label={t('profile.email')}
          placeholder={t('profile.placeholders.email')}
          type="email"
          {...bind.email}
          {...readOnly}
        />
        <Input
          label={t('profile.website')}
          placeholder={t('profile.placeholders.website')}
          type="url"
          {...bind.website}
          {...readOnly}
        />
      </div>
    </Card>
  );

  const managers = (
    <Card title={t('profile.managers')} headingLevel={2}>
      {isNew ? (
        <p className="text-sm text-fg-muted">{t('profile.managersNew')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {KEY_PEOPLE.map((role) => (
            <PersonFields key={role} role={role} bind={personBind[role]} isReadOnly={!canEdit} />
          ))}
        </div>
      )}
    </Card>
  );

  const toggleAmenity = (id: string, on: boolean) => {
    const current = bind.amenity_ids.value;
    bind.amenity_ids.onChange(
      on ? [...current.filter((value) => value !== id), id] : current.filter((value) => value !== id),
    );
  };

  const facilities = (
    <Card title={t('profile.facilities')} headingLevel={2}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div
          role="group"
          aria-label={t('profile.facilities')}
          className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {/* The factory is ticked by the factory register, not by hand. */}
          <Checkbox isSelected={hasFactory} isDisabled>
            {t('profile.factory')}
          </Checkbox>
          {amenityOptions.map((option) => (
            <Checkbox
              key={option.id}
              isSelected={bind.amenity_ids.value.includes(option.id)}
              isDisabled={!canEdit}
              onChange={(on) => {
                toggleAmenity(option.id, on);
              }}
            >
              {option.label}
            </Checkbox>
          ))}
        </div>
        <Input
          label={t('profile.otherAmenities')}
          placeholder={t('profile.placeholders.otherAmenities')}
          {...bind.other_amenities}
          {...readOnly}
        />
      </div>
      {bind.amenity_ids.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {bind.amenity_ids.error}
        </p>
      ) : null}
    </Card>
  );

  const geo = (
    <Card title={t('profile.geo')} headingLevel={2}>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <Input label={t('profile.latitude')} inputMode="decimal" {...bind.latitude} {...readOnly} />
          <Input label={t('profile.longitude')} inputMode="decimal" {...bind.longitude} {...readOnly} />
        </div>
        <LazyGeoMap
          label={t('profile.mapLabel', { name: estate?.name ?? t('estate.newTitle') })}
          point={point}
          {...(canEdit
            ? {
                onPick: ({ lat, lng }) => {
                  form.setValue('latitude', lat.toFixed(6), { shouldDirty: true, shouldValidate: true });
                  form.setValue('longitude', lng.toFixed(6), { shouldDirty: true, shouldValidate: true });
                },
              }
            : {})}
        />
        {canEdit ? <p className="text-sm text-fg-muted">{t('profile.mapHint')}</p> : null}
      </div>
    </Card>
  );

  const description = (
    <Card title={t('profile.description')} headingLevel={2}>
      <Textarea
        label={t('profile.description')}
        hideLabel
        placeholder={t('profile.placeholders.description')}
        rows={8}
        maxLength={4000}
        {...bind.description}
        {...readOnly}
      />
    </Card>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        {...(estate
          ? {
              status: {
                tone: estate.status === 'active' ? 'success' : 'neutral',
                label: t(`status.${estate.status}`),
              } as const,
            }
          : {})}
        description={estate ? estate.code : t('estate.newIntro')}
        breadcrumbs={[{ label: t('estate.backToList'), href: '/estates' }, { label: title }]}
        actions={
          estate && lifecycleText ? (
            <NodeLifecycle
              path="estates"
              node={estate}
              subject={estate.name}
              text={lifecycleText}
              canEdit={canEditExisting}
              canDelete={canDelete}
              onDeleted={() => {
                void navigate('/estates', { replace: true });
              }}
              onRefused={setRefusal}
            />
          ) : undefined
        }
      />
      {estate ? <EstateTabs estateId={estate.id} current="profile" /> : null}
      {!canEdit ? <PermissionNotice /> : null}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
            {basic}
            <EstateOverview
              estateId={estate?.id ?? ''}
              bind={{
                total_area: bind.total_area,
                tea_area: bind.tea_area,
                non_tea_area: bind.non_tea_area,
                field_count: bind.field_count,
                division_count: bind.division_count,
                section_count: bind.section_count,
                worker_count: bind.worker_count,
                family_count: bind.family_count,
              }}
              isReadOnly={!canEdit}
            />
            {managers}
            {facilities}
            {estate ? (
              <AttachmentsPanel
                owner={{ path: '/estates', id: estate.id }}
                module="estate"
                // Photographs have their own gallery above.
                excludeTypes={['PHOTOGRAPH']}
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-4">
            {estate ? (
              <EstatePhotos
                estateId={estate.id}
                estateName={estate.name}
                canEdit={canEditExisting}
                onRefused={setRefusal}
              />
            ) : null}
            {estate ? <EstateSummary estateId={estate.id} /> : null}
            {geo}
            {description}
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-col-reverse gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onPress={() => {
                void navigate('/estates');
              }}
            >
              {t('profile.cancel')}
            </Button>
            <Button
              variant="secondary"
              iconStart="refresh"
              className="w-full sm:w-auto"
              onPress={() => {
                form.reset(defaults);
              }}
            >
              {t('profile.reset')}
            </Button>
            <Button
              type="submit"
              isPending={create.isPending || update.isPending || savePerson.isPending}
              className="w-full sm:w-auto"
            >
              {isNew ? t('estate.create') : t('profile.save')}
            </Button>
          </div>
        ) : null}
      </form>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

/** One key person: a box with a small caption, and name, mobile and email in a row. */
function PersonFields({
  role,
  bind,
  isReadOnly,
}: {
  readonly role: KeyPerson;
  readonly bind: Readonly<Record<'contact_name' | 'designation' | 'phone' | 'email', FieldBinding<string>>>;
  readonly isReadOnly: boolean;
}) {
  const { t } = useTranslation('org');
  return (
    <fieldset className="rounded-lg border border-line p-4">
      <legend className="px-1 text-sm text-fg-muted">{t(`profile.roles.${role}`)}</legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Input
          label={t('profile.contactName')}
          placeholder={t('profile.placeholders.contactName')}
          autoComplete="off"
          {...bind.contact_name}
          isReadOnly={isReadOnly}
        />
        <Input
          label={t('profile.mobile')}
          placeholder={t('profile.placeholders.mobile')}
          type="tel"
          {...bind.phone}
          isReadOnly={isReadOnly}
        />
        <Input
          label={t('profile.contactEmail')}
          placeholder={t('profile.placeholders.contactEmail')}
          type="email"
          {...bind.email}
          isReadOnly={isReadOnly}
        />
      </div>
    </fieldset>
  );
}

export { EstatePage as Component };
