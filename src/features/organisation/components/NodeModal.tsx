import { z } from 'zod';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, Input, Modal, Select, Textarea, toast } from '@/ui';

import { useCreateNode, useSections, useUpdateNode } from '../api/hierarchy';
import { type Division, NODE_CODE, type Section } from '../api/schemas';
import { AreaInput } from './AreaInput';

/** What the modal edits: a new division or section under a parent, or an existing one. */
export type NodeEditor = { readonly kind: 'division' | 'section' } & (
  | { readonly mode: 'create'; readonly parentId: string; readonly parentName: string }
  | { readonly mode: 'edit'; readonly node: Division | Section }
);

export type NodeModalProps = NodeEditor & {
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
};

const NONE = 'none';

/**
 * Add or edit a division (under an estate) or a section (under a division): code, name, area and a description; a
 * section may also sit inside another section of its division. The manager / supervisor arrives with HR (Phase 2).
 */
export function NodeModal(props: NodeModalProps) {
  const { t } = useTranslation('org');
  const { kind, onClose, onRefused } = props;
  const editing = props.mode === 'edit' ? props.node : null;
  const create = useCreateNode(kind, props.mode === 'create' ? props.parentId : '');
  const update = useUpdateNode(kind, editing ?? ({ id: '', version: 0 } as Division));
  const pending = create.isPending || update.isPending;
  // A section's parent can be any other section of its division.
  const divisionId =
    kind === 'section'
      ? props.mode === 'create'
        ? props.parentId
        : (props.node as Section).division_id
      : '';
  const siblings = useSections(divisionId);
  const parentOptions = (siblings.data ?? [])
    .filter(
      (other) =>
        other.id !== editing?.id &&
        (other.status === 'active' || other.id === (editing as Section | null)?.parent_section_id),
    )
    .map((other) => ({ id: other.id, label: `${other.code} · ${other.name}` }));

  const schema = z.object({
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('structure.name').toLowerCase() }))
      .max(150),
    area: z.string().nullable(),
    description: z.string().trim().max(1000),
    parent_section_id: z.string().nullable(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      area: editing?.area ?? null,
      description: editing?.description ?? '',
      parent_section_id: (editing as Section | null)?.parent_section_id ?? null,
    },
  });
  const code = useFormField(form.control, 'code');
  const name = useFormField(form.control, 'name');
  const area = useFormField(form.control, 'area');
  const description = useFormField(form.control, 'description');
  const parentSection = useFormField(form.control, 'parent_section_id');

  const submit = form.handleSubmit(async (values) => {
    const input = {
      code: values.code.trim(),
      name: values.name.trim(),
      area: values.area,
      description: values.description === '' ? null : values.description,
      ...(kind === 'section' ? { parent_section_id: values.parent_section_id } : {}),
    };
    try {
      if (editing) {
        await update.mutateAsync(input);
        toast.success(t('structure.saved', { name: input.name }));
      } else {
        await create.mutateAsync(input);
        toast.success(t('structure.created', { name: input.name }));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
    }
  });

  let title: string;
  if (props.mode === 'create') {
    title =
      kind === 'division'
        ? t('structure.newDivision', { estate: props.parentName })
        : t('structure.newSection', { division: props.parentName });
  } else {
    title =
      kind === 'division'
        ? t('structure.editDivision', { name: props.node.name })
        : t('structure.editSection', { name: props.node.name });
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={pending}
            onPress={() => {
              void submit();
            }}
          >
            {t('actions.save')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Input label={t('structure.code')} isRequired autoComplete="off" {...code} />
        <Input label={t('structure.name')} isRequired autoComplete="off" {...name} />
        <AreaInput label={t('structure.area')} placeholder="0.00" {...area} />
        {kind === 'section' ? (
          <Select
            label={t('structure.parentSection')}
            placeholder={t('field.choose')}
            value={parentSection.value ?? NONE}
            options={[{ id: NONE, label: t('structure.noParentSection') }, ...parentOptions]}
            onChange={(value) => {
              parentSection.onChange(value === null || value === NONE ? null : value);
            }}
            {...(parentSection.error ? { error: parentSection.error } : {})}
          />
        ) : null}
        <Textarea
          label={t('structure.description')}
          placeholder={t(
            kind === 'division' ? 'structure.divisionDescriptionHint' : 'structure.sectionDescriptionHint',
          )}
          rows={3}
          maxLength={1000}
          {...description}
        />
      </form>
    </Modal>
  );
}
