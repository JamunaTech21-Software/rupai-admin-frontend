import { useState } from 'react';
import { z } from 'zod';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Button,
  Card,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  DatePicker,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  toast,
} from '@/ui';

import {
  type DependentInput,
  useAddDependent,
  useChangeDependent,
  usePersonDependents,
  useRemoveDependent,
} from '../api/persons';
import { type Dependent, GENDERS, RELATIONS } from '../api/schemas';

const NONE = 'none';
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Add or change one family member (the design's Dependent / Family Member rows). */
function DependentModal({
  personId,
  dependent,
  onClose,
  onRefused,
}: {
  readonly personId: string;
  readonly dependent: Dependent | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const add = useAddDependent(personId);
  const change = useChangeDependent(personId, dependent ?? { id: '', version: 0, name: '' });
  const schema = z.object({
    name: z.string().trim().min(1, t('validation.dependentName')).max(150),
    relation: z.enum(RELATIONS),
    occupation: z.string().trim().max(100),
    date_of_birth: z
      .string()
      .nullable()
      .refine((v) => v === null || v <= todayIso(), t('validation.notFuture')),
    gender: z.enum(GENDERS).nullable(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      name: dependent?.name ?? '',
      relation: dependent?.relation ?? 'son',
      occupation: dependent?.occupation ?? '',
      date_of_birth: dependent?.date_of_birth ?? null,
      gender: dependent?.gender ?? null,
    },
  });
  const bind = {
    name: useFormField(form.control, 'name'),
    relation: useFormField(form.control, 'relation'),
    occupation: useFormField(form.control, 'occupation'),
    date_of_birth: useFormField(form.control, 'date_of_birth'),
    gender: useFormField(form.control, 'gender'),
  };

  const submit = form.handleSubmit(async (v) => {
    const input: DependentInput = {
      name: v.name.trim(),
      relation: v.relation,
      occupation: v.occupation.trim() === '' ? null : v.occupation.trim(),
      date_of_birth: v.date_of_birth,
      gender: v.gender,
    };
    try {
      if (dependent) await change.mutateAsync(input);
      else await add.mutateAsync(input);
      toast.success(t(dependent ? 'dependents.saved' : 'dependents.added', { name: input.name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
      onClose();
    }
  });

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(dependent ? 'dependents.editTitle' : 'dependents.addTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('person.cancel')}
          </Button>
          <Button
            isPending={add.isPending || change.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('person.save')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Input
          label={t('dependents.name')}
          placeholder={t('dependents.namePlaceholder')}
          isRequired
          {...bind.name}
        />
        <Select
          label={t('dependents.relation')}
          isRequired
          value={bind.relation.value}
          options={RELATIONS.map((r) => ({ id: r, label: t(`relations.${r}`) }))}
          onChange={(next) => {
            const found = RELATIONS.find((r) => r === next);
            if (found) bind.relation.onChange(found);
          }}
        />
        <Input
          label={t('dependents.occupation')}
          placeholder={t('dependents.occupationPlaceholder')}
          {...bind.occupation}
        />
        <DatePicker
          label={t('dependents.dateOfBirth')}
          value={bind.date_of_birth.value}
          onChange={bind.date_of_birth.onChange}
          {...(bind.date_of_birth.error ? { error: bind.date_of_birth.error } : {})}
        />
        <Select
          label={t('dependents.gender')}
          placeholder={t('person.select')}
          value={bind.gender.value ?? NONE}
          options={[
            { id: NONE, label: t('person.notRecorded') },
            ...GENDERS.map((g) => ({ id: g, label: t(`genders.${g}`) })),
          ]}
          onChange={(next) => {
            bind.gender.onChange(GENDERS.find((g) => g === next) ?? null);
          }}
        />
      </form>
    </Modal>
  );
}

/** Edit and delete icons of one family member. */
function RowActions({
  personId,
  dependent,
  canEdit,
  onEdit,
  onRefused,
}: {
  readonly personId: string;
  readonly dependent: Dependent;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const remove = useRemoveDependent(personId, dependent);
  const [confirming, setConfirming] = useState(false);
  if (!canEdit) return null;
  return (
    <span className="flex items-center gap-1">
      <IconButton
        icon="edit"
        variant="ghost"
        size="sm"
        label={t('dependents.edit', { name: dependent.name })}
        onPress={onEdit}
      />
      <IconButton
        icon="trash"
        variant="ghost"
        size="sm"
        label={t('dependents.remove', { name: dependent.name })}
        onPress={() => {
          setConfirming(true);
        }}
      />
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t('dependents.removeTitle', { name: dependent.name })}
        consequence={t('dependents.removeBody')}
        confirmLabel={t('dependents.removeConfirm')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('dependents.removed', { name: dependent.name }));
          } catch (error) {
            onRefused(error);
          }
          setConfirming(false);
        }}
      />
    </span>
  );
}

/** The person's family members (person.view; changed with person.edit): the design's Dependent tab. */
export function DependentsPanel({
  personId,
  onRefused,
}: {
  readonly personId: string;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canEdit = usePermission('person.edit');
  const list = usePersonDependents(personId);
  const [editing, setEditing] = useState<Dependent | 'new' | null>(null);
  const rows = list.data ?? [];
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Dependent>[] = [
    { id: 'name', header: t('dependents.name'), cell: (d) => <span className="font-medium">{d.name}</span> },
    { id: 'relation', header: t('dependents.relation'), cell: (d) => t(`relations.${d.relation}`) },
    {
      id: 'occupation',
      header: t('dependents.occupation'),
      canHide: true,
      cell: (d) => d.occupation ?? none,
    },
    {
      id: 'dob',
      header: t('dependents.dateOfBirth'),
      canHide: true,
      cell: (d) =>
        d.date_of_birth
          ? `${format.date(d.date_of_birth)}${d.age === null ? '' : ` (${format.number(d.age)})`}`
          : none,
    },
    {
      id: 'gender',
      header: t('dependents.gender'),
      canHide: true,
      cell: (d) => (d.gender ? t(`genders.${d.gender}`) : none),
    },
    {
      id: 'actions',
      header: t('dependents.actions'),
      cell: (d) => (
        <RowActions
          personId={personId}
          dependent={d}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(d);
          }}
          onRefused={onRefused}
        />
      ),
    },
  ];

  return (
    <>
      <Card
        title={t('dependents.title')}
        headingLevel={2}
        {...(canEdit
          ? {
              actions: (
                <Button
                  size="sm"
                  iconStart="plus"
                  onPress={() => {
                    setEditing('new');
                  }}
                >
                  {t('dependents.add')}
                </Button>
              ),
            }
          : {})}
      >
        <DataTable
          label={t('dependents.title')}
          columns={columns}
          rows={rows}
          getRowId={(d) => d.id}
          getRowLabel={(d) => d.name}
          isLoading={list.isPending}
          error={
            list.isError ? { message: t('dependents.failed'), onRetry: () => void list.refetch() } : null
          }
          isPlain
          emptyState={
            <EmptyState
              kind="new"
              title={t('dependents.emptyTitle')}
              description={t('dependents.emptyBody')}
            />
          }
        />
      </Card>
      {editing ? (
        <DependentModal
          personId={personId}
          dependent={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </>
  );
}
