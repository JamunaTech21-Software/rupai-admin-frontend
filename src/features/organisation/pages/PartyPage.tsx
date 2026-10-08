import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Input, Select, toast } from '@/ui';

import { useCreateParty, useParty, useUpdateParty } from '../api/facilities';
import { NODE_CODE, type Party, PARTY_TYPES, PHONE } from '../api/schemas';
import { ContactsPanel } from '../components/ContactsPanel';
import { FacilityForm } from '../components/FacilityForm';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Organisation → Parties → one party (or a new one), with its contacts. */
export function PartyPage() {
  const { id } = useParams();
  if (id === undefined) return <PartyEditor party={null} />;
  return <ExistingParty id={id} />;
}

function ExistingParty({ id }: { readonly id: string }) {
  const query = useParty(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <PartyEditor key={`${query.data.id}-${String(query.data.version)}`} party={query.data} />;
}

function PartyEditor({ party }: { readonly party: Party | null }) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const canEdit = usePermission(party ? 'land.edit' : 'land.create');
  const canEditContacts = usePermission('land.edit');
  const create = useCreateParty();
  const update = useUpdateParty(party ?? ({ id: '', version: 0 } as Party));
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    party_type: z.enum(PARTY_TYPES),
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('party.name').toLowerCase() }))
      .max(150),
    national_id: z.string().trim().max(30),
    registration_number: z.string().trim().max(50),
    address_line1: z.string().trim().max(200),
    district: z.string().trim().max(100),
    phone: z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]),
    email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      party_type: party?.party_type ?? 'individual',
      code: party?.code ?? '',
      name: party?.name ?? '',
      national_id: party?.national_id ?? '',
      registration_number: party?.registration_number ?? '',
      address_line1: party?.address_line1 ?? '',
      district: party?.district ?? '',
      phone: party?.phone ?? '',
      email: party?.email ?? '',
    },
  });
  const bind = {
    party_type: useFormField(form.control, 'party_type'),
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    national_id: useFormField(form.control, 'national_id'),
    registration_number: useFormField(form.control, 'registration_number'),
    address_line1: useFormField(form.control, 'address_line1'),
    district: useFormField(form.control, 'district'),
    phone: useFormField(form.control, 'phone'),
    email: useFormField(form.control, 'email'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const submit = form.handleSubmit(async (values) => {
    const input = {
      party_type: values.party_type,
      code: values.code.trim(),
      name: values.name.trim(),
      national_id: blankToNull(values.national_id),
      registration_number: blankToNull(values.registration_number),
      address_line1: blankToNull(values.address_line1),
      district: blankToNull(values.district),
      phone: blankToNull(values.phone),
      email: blankToNull(values.email),
    };
    try {
      if (party) {
        await update.mutateAsync(input);
        toast.success(t('party.saved'));
      } else {
        const created = await create.mutateAsync(input);
        toast.success(t('party.created', { name: created.name }));
        void navigate(`/parties/${created.id}`, { replace: true });
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  return (
    <FacilityForm
      path="parties"
      record={party}
      title={party ? party.name : t('party.newTitle')}
      newIntro={t('party.newIntro')}
      backLabel={t('party.backToList')}
      editPermission="land.edit"
      createPermission="land.create"
      deletePermission="land.delete"
      detailsTitle={t('party.details')}
      submitLabel={party ? t('actions.save') : t('party.create')}
      isPending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void submit(event);
      }}
      refusal={refusal}
      onRefused={setRefusal}
      after={
        party ? (
          <ContactsPanel
            owner={{ path: 'parties', id: party.id }}
            canEdit={canEditContacts}
            onRefused={setRefusal}
          />
        ) : null
      }
    >
      <Select
        label={t('party.type')}
        isRequired
        isDisabled={!canEdit}
        value={bind.party_type.value}
        options={PARTY_TYPES.map((type) => ({ id: type, label: t(`partyType.${type}`) }))}
        onChange={(value) => {
          const type = PARTY_TYPES.find((option) => option === value);
          if (type) bind.party_type.onChange(type);
        }}
      />
      <Input label={t('party.code')} isRequired autoComplete="off" {...bind.code} {...readOnly} />
      <Input
        label={t('party.name')}
        isRequired
        autoComplete="off"
        className="md:col-span-2"
        {...bind.name}
        {...readOnly}
      />
      <Input label={t('party.nationalId')} {...bind.national_id} {...readOnly} />
      <Input label={t('party.registrationNumber')} {...bind.registration_number} {...readOnly} />
      <Input label={t('party.addressLine1')} {...bind.address_line1} {...readOnly} />
      <Input label={t('party.district')} {...bind.district} {...readOnly} />
      <Input label={t('party.phone')} type="tel" {...bind.phone} {...readOnly} />
      <Input label={t('party.email')} type="email" {...bind.email} {...readOnly} />
    </FacilityForm>
  );
}

export { PartyPage as Component };
