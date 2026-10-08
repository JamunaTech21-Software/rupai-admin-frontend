import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import {
  Button,
  ButtonLink,
  Card,
  DatePicker,
  Input,
  PageHeader,
  Select,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import { type EstateInput, useCreateEstate, useEstate, useUpdateEstate } from '../api/hierarchy';
import { type Estate, NODE_CODE, OWNERSHIP_TYPES, PHONE } from '../api/schemas';
import { EstateStructure } from '../components/EstateStructure';
import { NodeLifecycle } from '../components/NodeLifecycle';
import { AreaInput } from '../components/AreaInput';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Organisation → Estates → one estate (or a new one): its details, then its divisions and sections. */
export function EstatePage() {
  const { id } = useParams();
  if (id === undefined) return <EstateForm estate={null} />;
  return <ExistingEstate id={id} />;
}

function ExistingEstate({ id }: { readonly id: string }) {
  const query = useEstate(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <EstateForm key={`${query.data.id}-${String(query.data.version)}`} estate={query.data} />;
}

function EstateForm({ estate }: { readonly estate: Estate | null }) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const isNew = estate === null;
  const canEdit = usePermission(isNew ? 'estate.create' : 'estate.edit');
  const canDelete = usePermission('estate.delete');
  const canEditExisting = usePermission('estate.edit');
  const create = useCreateEstate();
  const update = useUpdateEstate(estate ?? ({ id: '', version: 0 } as Estate));
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('estate.name').toLowerCase() }))
      .max(150),
    location: z.string().trim().max(200),
    address_line1: z.string().trim().max(200),
    district: z.string().trim().max(100),
    total_area: z.string().nullable(),
    phone: z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]),
    email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
    established_on: z
      .string()
      .nullable()
      .refine((date) => date === null || date <= todayIso(), t('validation.notFuture')),
    ownership_type: z.string(),
    remarks: z.string().trim().max(500),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      code: estate?.code ?? '',
      name: estate?.name ?? '',
      location: estate?.location ?? '',
      address_line1: estate?.address_line1 ?? '',
      district: estate?.district ?? '',
      total_area: estate?.total_area ?? null,
      phone: estate?.phone ?? '',
      email: estate?.email ?? '',
      established_on: estate?.established_on ?? null,
      ownership_type: estate?.ownership_type ?? 'none',
      remarks: estate?.remarks ?? '',
    },
  });
  const bind = {
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    location: useFormField(form.control, 'location'),
    address_line1: useFormField(form.control, 'address_line1'),
    district: useFormField(form.control, 'district'),
    total_area: useFormField(form.control, 'total_area'),
    phone: useFormField(form.control, 'phone'),
    email: useFormField(form.control, 'email'),
    established_on: useFormField(form.control, 'established_on'),
    ownership_type: useFormField(form.control, 'ownership_type'),
    remarks: useFormField(form.control, 'remarks'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const submit = form.handleSubmit(async (values) => {
    const input: EstateInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      location: blankToNull(values.location),
      address_line1: blankToNull(values.address_line1),
      district: blankToNull(values.district),
      total_area: values.total_area,
      phone: blankToNull(values.phone),
      email: blankToNull(values.email),
      established_on: values.established_on,
      ownership_type:
        values.ownership_type === 'none' ? null : (values.ownership_type as (typeof OWNERSHIP_TYPES)[number]),
      remarks: blankToNull(values.remarks),
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(input);
        toast.success(t('estate.created', { name: created.name }));
        void navigate(`/estates/${created.id}`, { replace: true });
      } else {
        await update.mutateAsync(input);
        toast.success(t('estate.saved'));
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
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
            <>
              <ButtonLink href={`/fields?filter[estate_id]=${estate.id}`} variant="secondary">
                {t('estate.fieldsLink')}
              </ButtonLink>
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
            </>
          ) : undefined
        }
      />
      {!canEdit ? <PermissionNotice /> : null}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Card title={t('estate.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('estate.code')}
              hint={t('estate.codeHint')}
              isRequired
              autoComplete="off"
              {...bind.code}
              {...readOnly}
            />
            <Input label={t('estate.name')} isRequired autoComplete="off" {...bind.name} {...readOnly} />
            <Input label={t('estate.location')} {...bind.location} {...readOnly} />
            <Input label={t('estate.district')} {...bind.district} {...readOnly} />
            <Input
              label={t('estate.addressLine1')}
              className="md:col-span-2"
              {...bind.address_line1}
              {...readOnly}
            />
            <AreaInput label={t('estate.totalArea')} {...bind.total_area} {...readOnly} />
            <Select
              label={t('estate.ownershipType')}
              isDisabled={!canEdit}
              value={bind.ownership_type.value}
              onChange={(value) => {
                if (value) bind.ownership_type.onChange(value);
              }}
              options={[
                { id: 'none', label: t('estate.ownershipNone') },
                ...OWNERSHIP_TYPES.map((type) => ({ id: type, label: t(`ownership.${type}`) })),
              ]}
            />
            <DatePicker
              label={t('estate.establishedOn')}
              isReadOnly={!canEdit}
              value={bind.established_on.value}
              onChange={(date) => {
                bind.established_on.onChange(date);
              }}
              {...(bind.established_on.error ? { error: bind.established_on.error } : {})}
            />
            <Input label={t('estate.phone')} type="tel" {...bind.phone} {...readOnly} />
            <Input label={t('estate.email')} type="email" {...bind.email} {...readOnly} />
            <Textarea
              label={t('estate.remarks')}
              rows={2}
              maxLength={500}
              className="md:col-span-2"
              {...bind.remarks}
              {...readOnly}
            />
          </div>
        </Card>
        {canEdit ? (
          <div className="flex justify-end">
            <Button
              type="submit"
              isPending={create.isPending || update.isPending}
              className="w-full sm:w-auto"
            >
              {isNew ? t('estate.create') : t('actions.save')}
            </Button>
          </div>
        ) : null}
      </form>
      {estate ? <EstateStructure estate={estate} onRefused={setRefusal} /> : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { EstatePage as Component };
