import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { DatePicker, Input, QuantityInput, Select, toast } from '@/ui';

import { useCreateFactory, useFactory, useUpdateFactory } from '../api/facilities';
import { useAllEstates } from '../api/hierarchy';
import { type Factory, FACTORY_TYPES, NODE_CODE } from '../api/schemas';
import { FacilityForm } from '../components/FacilityForm';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Organisation → Factories → one factory (or a new one). */
export function FactoryPage() {
  const { id } = useParams();
  if (id === undefined) return <FactoryEditor factory={null} />;
  return <ExistingFactory id={id} />;
}

function ExistingFactory({ id }: { readonly id: string }) {
  const query = useFactory(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <FactoryEditor key={`${query.data.id}-${String(query.data.version)}`} factory={query.data} />;
}

function FactoryEditor({ factory }: { readonly factory: Factory | null }) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const canEdit = usePermission(factory ? 'factory.edit' : 'factory.create');
  const estates = useAllEstates();
  const create = useCreateFactory();
  const update = useUpdateFactory(factory ?? ({ id: '', version: 0 } as Factory));
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('factory.name').toLowerCase() }))
      .max(150),
    factory_type: z.enum(FACTORY_TYPES),
    primary_estate_id: z.string(),
    location: z.string().trim().max(200),
    daily_capacity_kg: z.string().nullable(),
    licence_number: z.string().trim().max(50),
    licence_expiry: z.string().nullable(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      code: factory?.code ?? '',
      name: factory?.name ?? '',
      factory_type: factory?.factory_type ?? 'own',
      primary_estate_id: factory?.primary_estate_id ?? 'none',
      location: factory?.location ?? '',
      daily_capacity_kg: factory?.daily_capacity_kg ?? null,
      licence_number: factory?.licence_number ?? '',
      licence_expiry: factory?.licence_expiry ?? null,
    },
  });
  const bind = {
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    factory_type: useFormField(form.control, 'factory_type'),
    primary_estate_id: useFormField(form.control, 'primary_estate_id'),
    location: useFormField(form.control, 'location'),
    daily_capacity_kg: useFormField(form.control, 'daily_capacity_kg'),
    licence_number: useFormField(form.control, 'licence_number'),
    licence_expiry: useFormField(form.control, 'licence_expiry'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const submit = form.handleSubmit(async (values) => {
    const input = {
      code: values.code.trim(),
      name: values.name.trim(),
      factory_type: values.factory_type,
      primary_estate_id: values.primary_estate_id === 'none' ? null : values.primary_estate_id,
      location: blankToNull(values.location),
      daily_capacity_kg: values.daily_capacity_kg,
      licence_number: blankToNull(values.licence_number),
      licence_expiry: values.licence_expiry,
    };
    try {
      if (factory) {
        await update.mutateAsync(input);
        toast.success(t('factory.saved'));
      } else {
        const created = await create.mutateAsync(input);
        toast.success(t('factory.created', { name: created.name }));
        void navigate(`/factories/${created.id}`, { replace: true });
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
      path="factories"
      record={factory}
      title={factory ? factory.name : t('factory.newTitle')}
      newIntro={t('factory.newIntro')}
      backLabel={t('factory.backToList')}
      editPermission="factory.edit"
      createPermission="factory.create"
      deletePermission="factory.delete"
      detailsTitle={t('factory.details')}
      submitLabel={factory ? t('actions.save') : t('factory.create')}
      isPending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void submit(event);
      }}
      refusal={refusal}
      onRefused={setRefusal}
    >
      <Input label={t('factory.code')} isRequired autoComplete="off" {...bind.code} {...readOnly} />
      <Input label={t('factory.name')} isRequired autoComplete="off" {...bind.name} {...readOnly} />
      <Select
        label={t('factory.type')}
        isRequired
        isDisabled={!canEdit}
        value={bind.factory_type.value}
        options={FACTORY_TYPES.map((type) => ({ id: type, label: t(`factoryType.${type}`) }))}
        onChange={(value) => {
          const type = FACTORY_TYPES.find((option) => option === value);
          if (type) bind.factory_type.onChange(type);
        }}
      />
      <Select
        label={t('factory.primaryEstate')}
        hint={t('factory.primaryEstateHint')}
        isDisabled={!canEdit}
        value={bind.primary_estate_id.value}
        options={[
          { id: 'none', label: t('factory.noEstate') },
          ...(estates.data ?? []).map((estate) => ({
            id: estate.id,
            label: `${estate.code} · ${estate.name}`,
          })),
        ]}
        onChange={(value) => {
          if (value) bind.primary_estate_id.onChange(value);
        }}
      />
      <Input label={t('factory.location')} {...bind.location} {...readOnly} />
      <QuantityInput label={t('factory.dailyCapacity')} {...bind.daily_capacity_kg} {...readOnly} />
      <Input label={t('factory.licenceNumber')} {...bind.licence_number} {...readOnly} />
      <DatePicker
        label={t('factory.licenceExpiry')}
        isReadOnly={!canEdit}
        value={bind.licence_expiry.value}
        onChange={bind.licence_expiry.onChange}
        {...(bind.licence_expiry.error ? { error: bind.licence_expiry.error } : {})}
      />
    </FacilityForm>
  );
}

export { FactoryPage as Component };
