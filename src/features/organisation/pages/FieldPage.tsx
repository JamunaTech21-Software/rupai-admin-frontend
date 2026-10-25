import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { z } from 'zod';

import { AttachmentsPanel } from '@/features/documents';
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
  NumberInput,
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
  useEstateFields,
  useField,
  useSection,
  useSections,
  useUpdateField,
} from '../api/hierarchy';
import { type Field, FIELD_STATUSES, FIELD_TYPES, NODE_CODE } from '../api/schemas';
import { BoundaryCard } from '../components/BoundaryCard';
import { LookupSelect } from '../components/LookupSelect';
import { MoveFieldModal } from '../components/MoveFieldModal';
import { NodeLifecycle } from '../components/NodeLifecycle';
import { AreaInput } from '../components/AreaInput';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());
const todayIso = () => new Date().toISOString().slice(0, 10);
const thisYear = () => new Date().getFullYear();
const NONE = 'none';

/** A number with at most two decimals inside a range, typed as text (`''` when empty). */
const twoPlaces = (min: string, max: string) => (value: string) => {
  if (value === '') return true;
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return false;
  const n = new Dec(value);
  return n.gte(min) && n.lte(max);
};

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
        { term: t('field.createdBy'), description: field.created_by.username },
        { term: t('field.createdOn'), description: format.dateTime(field.created_at) },
      ]}
    />
  );
}

/** Estate → division → section, for a new field (the section decides the estate). */
function LocationPicker({
  sectionId,
  onSection,
  onEstate,
  error,
}: {
  readonly sectionId: string | null;
  readonly onSection: (id: string | null) => void;
  /** Told when the estate is chosen (a new field's parent can only be a field of that estate). */
  readonly onEstate: (id: string | null) => void;
  readonly error: string | undefined;
}) {
  const { t } = useTranslation('org');
  const [params] = useSearchParams();
  const estates = useAllEstates();
  const [estateId, setEstateIdState] = useState<string | null>(params.get('estate'));
  const setEstateId = (id: string | null) => {
    setEstateIdState(id);
    onEstate(id);
  };
  // The estate may come with the link (/fields/new?estate=1): say so once.
  useEffect(() => {
    onEstate(params.get('estate'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on arrival
  }, []);
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
  // The estate decides which fields can be this one's parent: its own, or the one chosen for a new field.
  const [pickedEstate, setPickedEstate] = useState<string | null>(null);
  const estateFields = useEstateFields(field?.estate_id ?? pickedEstate ?? '');
  const parentOptions = (estateFields.data ?? [])
    .filter((other) => other.id !== field?.id)
    .map((other) => ({
      id: other.id,
      label: other.name ? `${other.field_number} · ${other.name}` : other.field_number,
    }));
  if (field?.parent_field && !parentOptions.some((option) => option.id === field.parent_field?.id))
    parentOptions.push({ id: field.parent_field.id, label: field.parent_field.field_number });

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
      field_type: z.enum(FIELD_TYPES),
      parent_field_id: z.string().nullable(),
      planting_year: z
        .number()
        .int()
        .min(1800, t('field.yearRange', { max: thisYear() }))
        .max(thisYear(), t('field.yearRange', { max: thisYear() }))
        .nullable(),
      tea_variety_id: z.string().nullable(),
      spacing: z.string().trim().max(50),
      altitude: z.string().trim().refine(twoPlaces('-1000', '30000'), t('field.altitudeInvalid')),
      average_slope: z.string().trim().refine(twoPlaces('0', '90'), t('field.slopeInvalid')),
      irrigation_source_id: z.string().nullable(),
      soil_type_id: z.string().nullable(),
      drainage_class_id: z.string().nullable(),
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
      field_type: field?.field_type ?? 'tea_field',
      parent_field_id: field?.parent_field_id ?? null,
      planting_year: field?.planting_year ?? null,
      tea_variety_id: field?.tea_variety_id ?? null,
      spacing: field?.spacing ?? '',
      altitude: field?.altitude ?? '',
      average_slope: field?.average_slope ?? '',
      irrigation_source_id: field?.irrigation_source_id ?? null,
      soil_type_id: field?.soil_type_id ?? null,
      drainage_class_id: field?.drainage_class_id ?? null,
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
    field_type: useFormField(form.control, 'field_type'),
    parent_field_id: useFormField(form.control, 'parent_field_id'),
    planting_year: useFormField(form.control, 'planting_year'),
    tea_variety_id: useFormField(form.control, 'tea_variety_id'),
    spacing: useFormField(form.control, 'spacing'),
    altitude: useFormField(form.control, 'altitude'),
    average_slope: useFormField(form.control, 'average_slope'),
    irrigation_source_id: useFormField(form.control, 'irrigation_source_id'),
    soil_type_id: useFormField(form.control, 'soil_type_id'),
    drainage_class_id: useFormField(form.control, 'drainage_class_id'),
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
      field_type: values.field_type,
      parent_field_id: values.parent_field_id,
      planting_year: values.planting_year,
      tea_variety_id: values.tea_variety_id,
      spacing: blankToNull(values.spacing),
      altitude: blankToNull(values.altitude),
      average_slope: blankToNull(values.average_slope),
      irrigation_source_id: values.irrigation_source_id,
      soil_type_id: values.soil_type_id,
      drainage_class_id: values.drainage_class_id,
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
        void navigate('/fields');
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
              onEstate={setPickedEstate}
              error={bind.section_id.error}
            />
          )}
        </Card>
        <Card title={t('field.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            <Input
              label={t('field.name')}
              placeholder={t('field.placeholders.name')}
              autoComplete="off"
              {...bind.name}
              {...readOnly}
            />
            <Input
              label={t('field.fieldNumber')}
              placeholder={t('field.placeholders.code')}
              isRequired
              autoComplete="off"
              {...bind.field_number}
              {...readOnly}
            />
            <Select
              label={t('field.fieldType')}
              isDisabled={!canEdit}
              value={bind.field_type.value}
              options={FIELD_TYPES.map((type) => ({ id: type, label: t(`fieldType.${type}`) }))}
              onChange={(value) => {
                const type = FIELD_TYPES.find((option) => option === value);
                if (type) bind.field_type.onChange(type);
              }}
            />
            <Select
              label={t('field.parentField')}
              placeholder={t('field.choose')}
              isDisabled={!canEdit}
              value={bind.parent_field_id.value ?? NONE}
              options={[{ id: NONE, label: t('field.noParent') }, ...parentOptions]}
              onChange={(value) => {
                bind.parent_field_id.onChange(value === null || value === NONE ? null : value);
              }}
              {...(bind.parent_field_id.error ? { error: bind.parent_field_id.error } : {})}
            />
            <AreaInput
              label={t('field.grossArea')}
              placeholder="0.00"
              isRequired
              {...bind.gross_area}
              {...readOnly}
            />
            <AreaInput
              label={t('field.plantedArea')}
              hint={t('field.plantedAreaHint')}
              placeholder="0.00"
              {...bind.planted_area}
              {...readOnly}
            />
            <NumberInput
              label={t('field.plantingYear')}
              placeholder={t('field.placeholders.year')}
              formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
              minValue={1800}
              maxValue={thisYear()}
              {...bind.planting_year}
              {...readOnly}
            />
            <LookupSelect
              type="tea_variety"
              label={t('field.bushType')}
              value={bind.tea_variety_id.value}
              current={field?.tea_variety ?? null}
              isDisabled={!canEdit}
              onChange={bind.tea_variety_id.onChange}
              error={bind.tea_variety_id.error}
            />
            <Input
              label={t('field.spacing')}
              placeholder={t('field.placeholders.spacing')}
              {...bind.spacing}
              {...readOnly}
            />
            <Input
              label={t('field.altitude')}
              placeholder={t('field.placeholders.altitude')}
              inputMode="decimal"
              {...bind.altitude}
              {...readOnly}
            />
            <Input
              label={t('field.averageSlope')}
              placeholder={t('field.placeholders.slope')}
              inputMode="decimal"
              {...bind.average_slope}
              {...readOnly}
            />
            <LookupSelect
              type="irrigation_source"
              label={t('field.irrigationSource')}
              value={bind.irrigation_source_id.value}
              current={field?.irrigation_source ?? null}
              isDisabled={!canEdit}
              onChange={bind.irrigation_source_id.onChange}
              error={bind.irrigation_source_id.error}
            />
            <LookupSelect
              type="soil_type"
              label={t('field.soilType')}
              value={bind.soil_type_id.value}
              current={field?.soil_type ?? null}
              isDisabled={!canEdit}
              onChange={bind.soil_type_id.onChange}
              error={bind.soil_type_id.error}
            />
            <LookupSelect
              type="drainage_class"
              label={t('field.drainage')}
              value={bind.drainage_class_id.value}
              current={field?.drainage_class ?? null}
              isDisabled={!canEdit}
              onChange={bind.drainage_class_id.onChange}
              error={bind.drainage_class_id.error}
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
              placeholder={t('field.placeholders.remarks')}
              rows={3}
              maxLength={500}
              className="sm:col-span-2 xl:col-span-3"
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
      {field ? (
        <BoundaryCard field={field} />
      ) : (
        <p className="text-sm text-fg-muted">{t('boundary.saveFirst')}</p>
      )}
      {field ? <AttachmentsPanel owner={{ path: '/fields', id: field.id }} module="field" /> : null}
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
