import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  Button,
  Card,
  DatePicker,
  DescriptionList,
  Input,
  PageHeader,
  Select,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import {
  type FieldInput,
  useAllEstates,
  useCreateField,
  useDivision,
  useDivisions,
  useField,
  useSection,
  useSections,
  useUpdateField,
} from '../api/hierarchy';
import { type Field, FIELD_STATUSES, NODE_CODE } from '../api/schemas';
import { MoveFieldModal } from '../components/MoveFieldModal';
import { NodeLifecycle } from '../components/NodeLifecycle';
import { AreaInput } from '../components/AreaInput';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Organisation → Fields → one field (or a new one). */
export function FieldPage() {
  const { id } = useParams();
  if (id === undefined) return <FieldForm field={null} />;
  return <ExistingField id={id} />;
}

function ExistingField({ id }: { readonly id: string }) {
  const query = useField(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <FieldForm key={`${query.data.id}-${String(query.data.version)}`} field={query.data} />;
}

/** Where an existing field is: Estate › Division › Section, since a date. */
function FieldLocation({ field }: { readonly field: Field }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const estates = useAllEstates();
  const division = useDivision(field.division_id);
  const section = useSection(field.section_id);
  const estate = estates.data?.find((e) => e.id === field.estate_id);
  const label = (node: { code: string; name: string } | undefined) =>
    node ? `${node.code} · ${node.name}` : '…';
  return (
    <DescriptionList
      columns={3}
      items={[
        { term: t('field.estate'), description: label(estate) },
        { term: t('field.division'), description: label(division.data) },
        {
          term: t('field.section'),
          description: (
            <span className="flex flex-col">
              {label(section.data)}
              {field.section_effective_from ? (
                <span className="text-sm text-fg-muted">
                  {t('field.since', { date: format.date(field.section_effective_from) })}
                </span>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  );
}

/** Estate → division → section, for a new field (the section decides the estate). */
function LocationPicker({
  sectionId,
  onSection,
  error,
}: {
  readonly sectionId: string | null;
  readonly onSection: (id: string | null) => void;
  readonly error: string | undefined;
}) {
  const { t } = useTranslation('org');
  const [params] = useSearchParams();
  const estates = useAllEstates();
  const [estateId, setEstateId] = useState<string | null>(params.get('estate'));
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const divisions = useDivisions(estateId ?? '');
  const sections = useSections(divisionId ?? '');
  const active = <T extends { status: string }>(rows: readonly T[] | undefined) =>
    (rows ?? []).filter((row) => row.status === 'active');
  const option = (node: { id: string; code: string; name: string }) => ({
    id: node.id,
    label: `${node.code} · ${node.name}`,
  });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Select
        label={t('field.estate')}
        isRequired
        placeholder={t('field.choose')}
        value={estateId}
        options={active(estates.data).map(option)}
        onChange={(value) => {
          setEstateId(value);
          setDivisionId(null);
          onSection(null);
        }}
      />
      <Select
        label={t('field.division')}
        isRequired
        isDisabled={!estateId}
        placeholder={t('field.choose')}
        value={divisionId}
        options={active(divisions.data).map(option)}
        onChange={(value) => {
          setDivisionId(value);
          onSection(null);
        }}
      />
      <Select
        label={t('field.section')}
        isRequired
        isDisabled={!divisionId}
        placeholder={t('field.choose')}
        value={sectionId}
        options={active(sections.data).map(option)}
        onChange={onSection}
        {...(error ? { error } : {})}
      />
    </div>
  );
}

function FieldForm({ field }: { readonly field: Field | null }) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const isNew = field === null;
  const canEdit = usePermission(isNew ? 'field.create' : 'field.edit');
  const canEditExisting = usePermission('field.edit');
  const canDelete = usePermission('field.delete');
  const create = useCreateField();
  const update = useUpdateField(field ?? ({ id: '', version: 0 } as Field));
  const [refusal, setRefusal] = useState<unknown>(null);
  const [moving, setMoving] = useState(false);

  const schema = z
    .object({
      section_id: z.string().nullable(),
      field_number: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
      name: z.string().trim().max(150),
      gross_area: z
        .string()
        .nullable()
        .refine((value) => value !== null && new Dec(value).gt(0), t('validation.positive')),
      planted_area: z.string().nullable(),
      field_status: z.enum(FIELD_STATUSES),
      section_effective_from: z
        .string()
        .nullable()
        .refine((date) => date === null || date <= todayIso(), t('validation.notFuture')),
      remarks: z.string().trim().max(500),
    })
    .refine((v) => !isNew || v.section_id !== null, {
      path: ['section_id'],
      message: t('validation.choose', { field: t('field.section').toLowerCase() }),
    })
    .refine(
      (v) => v.planted_area === null || v.gross_area === null || new Dec(v.planted_area).lte(v.gross_area),
      { path: ['planted_area'], message: t('field.plantedTooLarge') },
    );
  const form = useZodForm(schema, {
    defaultValues: {
      section_id: field?.section_id ?? null,
      field_number: field?.field_number ?? '',
      name: field?.name ?? '',
      gross_area: field?.gross_area ?? null,
      planted_area: field?.planted_area ?? null,
      field_status: field?.field_status ?? 'producing',
      section_effective_from: null,
      remarks: field?.remarks ?? '',
    },
  });
  const bind = {
    section_id: useFormField(form.control, 'section_id'),
    field_number: useFormField(form.control, 'field_number'),
    name: useFormField(form.control, 'name'),
    gross_area: useFormField(form.control, 'gross_area'),
    planted_area: useFormField(form.control, 'planted_area'),
    field_status: useFormField(form.control, 'field_status'),
    section_effective_from: useFormField(form.control, 'section_effective_from'),
    remarks: useFormField(form.control, 'remarks'),
  };
  const readOnly = { isReadOnly: !canEdit };

  const submit = form.handleSubmit(async (values) => {
    const input: FieldInput = {
      field_number: values.field_number.trim(),
      name: blankToNull(values.name),
      gross_area: values.gross_area ?? '0',
      planted_area: values.planted_area,
      field_status: values.field_status,
      remarks: blankToNull(values.remarks),
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync({
          ...input,
          section_id: values.section_id ?? '',
          ...(values.section_effective_from ? { section_effective_from: values.section_effective_from } : {}),
        });
        toast.success(t('field.created', { number: created.field_number }));
        void navigate(`/fields/${created.id}`, { replace: true });
      } else {
        await update.mutateAsync(input);
        toast.success(t('field.saved'));
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  const title = field ? field.field_number : t('field.newTitle');
  const number = field?.field_number ?? '';

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        {...(field
          ? {
              status: {
                tone: field.status === 'active' ? 'success' : 'neutral',
                label: t(`status.${field.status}`),
              } as const,
            }
          : {})}
        description={field ? (field.name ?? t(`fieldStatus.${field.field_status}`)) : t('field.newIntro')}
        breadcrumbs={[{ label: t('field.backToList'), href: '/fields' }, { label: title }]}
        actions={
          field ? (
            <NodeLifecycle
              path="fields"
              node={field}
              subject={field.field_number}
              text={{
                deactivateTitle: t('field.deactivateTitle', { number }),
                deactivateBody: t('field.deactivateBody'),
                reactivateTitle: t('field.reactivateTitle', { number }),
                reactivateBody: t('field.reactivateBody'),
                deleteTitle: t('field.deleteTitle', { number }),
                deleteBody: t('field.deleteBody'),
                deactivated: t('field.deactivated', { number }),
                reactivated: t('field.reactivated', { number }),
                deleted: t('field.deleted', { number }),
              }}
              canEdit={canEditExisting}
              canDelete={canDelete}
              onDeleted={() => {
                void navigate('/fields', { replace: true });
              }}
              onRefused={setRefusal}
            />
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
        <Card
          title={t('field.location')}
          headingLevel={2}
          {...(field && canEditExisting && field.status === 'active'
            ? {
                actions: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setMoving(true);
                    }}
                  >
                    {t('field.move')}
                  </Button>
                ),
              }
            : {})}
        >
          {field ? (
            <FieldLocation field={field} />
          ) : (
            <LocationPicker
              sectionId={bind.section_id.value}
              onSection={bind.section_id.onChange}
              error={bind.section_id.error}
            />
          )}
        </Card>
        <Card title={t('field.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('field.fieldNumber')}
              hint={t('field.fieldNumberHint')}
              isRequired
              autoComplete="off"
              {...bind.field_number}
              {...readOnly}
            />
            <Input label={t('field.name')} autoComplete="off" {...bind.name} {...readOnly} />
            <AreaInput
              label={t('field.grossArea')}

              isRequired
              {...bind.gross_area}
              {...readOnly}
            />
            <AreaInput
              label={t('field.plantedArea')}
              hint={t('field.plantedAreaHint')}

              {...bind.planted_area}
              {...readOnly}
            />
            <Select
              label={t('field.fieldStatus')}
              isDisabled={!canEdit}
              value={bind.field_status.value}
              options={FIELD_STATUSES.map((status) => ({ id: status, label: t(`fieldStatus.${status}`) }))}
              onChange={(value) => {
                const status = FIELD_STATUSES.find((option) => option === value);
                if (status) bind.field_status.onChange(status);
              }}
            />
            {isNew ? (
              <DatePicker
                label={t('field.sectionFrom')}
                hint={t('field.sectionFromHint')}
                value={bind.section_effective_from.value}
                onChange={bind.section_effective_from.onChange}
                {...(bind.section_effective_from.error ? { error: bind.section_effective_from.error } : {})}
              />
            ) : null}
            <Textarea
              label={t('field.remarks')}
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
              {isNew ? t('field.create') : t('actions.save')}
            </Button>
          </div>
        ) : null}
      </form>
      {moving && field ? (
        <MoveFieldModal
          field={field}
          onClose={() => {
            setMoving(false);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { FieldPage as Component };
