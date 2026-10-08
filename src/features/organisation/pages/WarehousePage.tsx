import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { DatePicker, Input, QuantityInput, Select, toast } from '@/ui';

import { useCreateWarehouse, useUpdateWarehouse, useWarehouse } from '../api/facilities';
import { NODE_CODE, type Warehouse, WAREHOUSE_TYPES } from '../api/schemas';
import { ContactsPanel } from '../components/ContactsPanel';
import { FacilityForm } from '../components/FacilityForm';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Organisation → Warehouses → one warehouse (or a new one), with its contacts. */
export function WarehousePage() {
  const { id } = useParams();
  if (id === undefined) return <WarehouseEditor warehouse={null} />;
  return <ExistingWarehouse id={id} />;
}

function ExistingWarehouse({ id }: { readonly id: string }) {
  const query = useWarehouse(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <WarehouseEditor key={`${query.data.id}-${String(query.data.version)}`} warehouse={query.data} />;
}

function WarehouseEditor({ warehouse }: { readonly warehouse: Warehouse | null }) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const canEdit = usePermission(warehouse ? 'warehouse.edit' : 'warehouse.create');
  const canEditContacts = usePermission('warehouse.edit');
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse(warehouse ?? ({ id: '', version: 0 } as Warehouse));
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('warehouse.name').toLowerCase() }))
      .max(150),
    warehouse_type: z.enum(WAREHOUSE_TYPES),
    location: z.string().trim().max(200),
    capacity_kg: z.string().nullable(),
    licence_number: z.string().trim().max(50),
    licence_expiry: z.string().nullable(),
    tin: z.string().trim().max(30),
    vat_registration: z.string().trim().max(30),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      warehouse_type: warehouse?.warehouse_type ?? 'own',
      location: warehouse?.location ?? '',
      capacity_kg: warehouse?.capacity_kg ?? null,
      licence_number: warehouse?.licence_number ?? '',
      licence_expiry: warehouse?.licence_expiry ?? null,
      tin: warehouse?.tin ?? '',
      vat_registration: warehouse?.vat_registration ?? '',
    },
  });
  const bind = {
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    warehouse_type: useFormField(form.control, 'warehouse_type'),
    location: useFormField(form.control, 'location'),
    capacity_kg: useFormField(form.control, 'capacity_kg'),
    licence_number: useFormField(form.control, 'licence_number'),
    licence_expiry: useFormField(form.control, 'licence_expiry'),
    tin: useFormField(form.control, 'tin'),
    vat_registration: useFormField(form.control, 'vat_registration'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const submit = form.handleSubmit(async (values) => {
    const input = {
      code: values.code.trim(),
      name: values.name.trim(),
      warehouse_type: values.warehouse_type,
      location: blankToNull(values.location),
      capacity_kg: values.capacity_kg,
      licence_number: blankToNull(values.licence_number),
      licence_expiry: values.licence_expiry,
      tin: blankToNull(values.tin),
      vat_registration: blankToNull(values.vat_registration),
    };
    try {
      if (warehouse) {
        await update.mutateAsync(input);
        toast.success(t('warehouse.saved'));
      } else {
        const created = await create.mutateAsync(input);
        toast.success(t('warehouse.created', { name: created.name }));
        void navigate(`/warehouses/${created.id}`, { replace: true });
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
      path="warehouses"
      record={warehouse}
      title={warehouse ? warehouse.name : t('warehouse.newTitle')}
      newIntro={t('warehouse.newIntro')}
      backLabel={t('warehouse.backToList')}
      editPermission="warehouse.edit"
      createPermission="warehouse.create"
      deletePermission="warehouse.delete"
      detailsTitle={t('warehouse.details')}
      submitLabel={warehouse ? t('actions.save') : t('warehouse.create')}
      isPending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void submit(event);
      }}
      refusal={refusal}
      onRefused={setRefusal}
      after={
        warehouse ? (
          <ContactsPanel
            owner={{ path: 'warehouses', id: warehouse.id }}
            canEdit={canEditContacts}
            onRefused={setRefusal}
          />
        ) : null
      }
    >
      <Input label={t('warehouse.code')} isRequired autoComplete="off" {...bind.code} {...readOnly} />
      <Input label={t('warehouse.name')} isRequired autoComplete="off" {...bind.name} {...readOnly} />
      <Select
        label={t('warehouse.type')}
        isRequired
        isDisabled={!canEdit}
        value={bind.warehouse_type.value}
        options={WAREHOUSE_TYPES.map((type) => ({ id: type, label: t(`warehouseType.${type}`) }))}
        onChange={(value) => {
          const type = WAREHOUSE_TYPES.find((option) => option === value);
          if (type) bind.warehouse_type.onChange(type);
        }}
      />
      <Input label={t('warehouse.location')} {...bind.location} {...readOnly} />
      <QuantityInput label={t('warehouse.capacity')} {...bind.capacity_kg} {...readOnly} />
      {warehouse ? (
        // The primary contact's phone: shown, never sent (the API refuses it here).
        <Input
          label={t('warehouse.phone')}
          hint={t('warehouse.phoneHint')}
          value={warehouse.phone ?? ''}
          isReadOnly
        />
      ) : null}
      <Input label={t('warehouse.licenceNumber')} {...bind.licence_number} {...readOnly} />
      <DatePicker
        label={t('warehouse.licenceExpiry')}
        isReadOnly={!canEdit}
        value={bind.licence_expiry.value}
        onChange={bind.licence_expiry.onChange}
        {...(bind.licence_expiry.error ? { error: bind.licence_expiry.error } : {})}
      />
      <Input label={t('warehouse.tin')} {...bind.tin} {...readOnly} />
      <Input label={t('warehouse.vat')} {...bind.vat_registration} {...readOnly} />
    </FacilityForm>
  );
}

export { WarehousePage as Component };
