import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  Input,
  NumberInput,
  PageHeader,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalogue,
  useRole,
  useSetRoleStatus,
  useUpdateRole,
} from '../api/roles';
import { type Permission, type Role, ROLE_CODE } from '../api/schemas';
import { PermissionMatrix } from '../components/PermissionMatrix';

/** Admin → Roles → a role (or a new one): its details and its permission matrix. */
export function RoleEditorPage() {
  const { id } = useParams();
  const catalogue = usePermissionCatalogue();
  if (id === undefined) {
    if (catalogue.isPending) return <PageLoading />;
    if (catalogue.isError)
      return <PageError error={catalogue.error} onRetry={() => void catalogue.refetch()} />;
    return <RoleForm role={null} catalogue={catalogue.data} />;
  }
  return <ExistingRole id={id} catalogue={catalogue} />;
}

function ExistingRole({
  id,
  catalogue,
}: {
  readonly id: string;
  readonly catalogue: ReturnType<typeof usePermissionCatalogue>;
}) {
  const role = useRole(id);
  if (role.isPending || catalogue.isPending) return <PageLoading />;
  if (role.isError) return <PageError error={role.error} onRetry={() => void role.refetch()} />;
  if (catalogue.isError)
    return <PageError error={catalogue.error} onRetry={() => void catalogue.refetch()} />;
  // Keyed by version, so the form shows the saved values after every save or conflict reload.
  return (
    <RoleForm
      key={`${role.data.id}-${String(role.data.version)}`}
      role={role.data}
      catalogue={catalogue.data}
    />
  );
}

type Dialog = 'status' | 'delete' | null;

function RoleForm({
  role,
  catalogue,
}: {
  readonly role: Role | null;
  readonly catalogue: readonly Permission[];
}) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const navigate = useNavigate();
  const isNew = role === null;
  const canEdit = usePermission(isNew ? 'role.create' : 'role.edit');
  const canDelete = usePermission('role.delete');
  const isSystem = role?.is_system ?? false;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    code: z.string().trim().regex(ROLE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('role.name').toLowerCase() }))
      .max(150),
    description: z.string().trim().max(1000),
    sort_order: z.number({ error: t('validation.sortOrder') }).int(t('validation.sortOrder')),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      code: role?.code ?? '',
      name: role?.name ?? '',
      description: role?.description ?? '',
      sort_order: role?.sort_order ?? 100,
    },
  });

  const create = useCreateRole();
  const update = useUpdateRole(role ?? ({} as Role));
  const saving = isNew ? create.isPending : update.isPending;
  const permissionsLocked = isSystem || !canEdit;

  const submit = form.handleSubmit(async (values) => {
    const input = {
      code: values.code,
      name: values.name,
      description: values.description === '' ? null : values.description,
      sort_order: values.sort_order,
      permissions: [...selected].sort(),
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(input);
        toast.success(t('role.created', { name: created.name }));
        void navigate(`/admin/roles/${created.id}`, { replace: true });
      } else {
        await update.mutateAsync(input);
        toast.success(t('role.saved'));
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  const title = isNew ? t('role.newTitle') : role.name;

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        {...(role
          ? {
              status: {
                tone: role.status === 'active' ? 'success' : 'neutral',
                label: t(`status.${role.status}`),
              } as const,
            }
          : {})}
        description={isNew ? t('role.newIntro') : t('role.usersCount', { count: role.user_count })}
        breadcrumbs={[{ label: t('role.backToList'), href: '/admin/roles' }, { label: title }]}
        actions={
          role ? (
            <RoleActions role={role} canEdit={canEdit} canDelete={canDelete} onOpen={setDialog} />
          ) : undefined
        }
      />
      {!canEdit ? <PermissionNotice /> : null}
      {isSystem ? <Alert tone="info">{t('role.systemNotice')}</Alert> : null}

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Card title={t('role.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('role.code')}
              hint={t('role.codeHint')}
              isRequired
              isReadOnly={isSystem || !canEdit}
              autoComplete="off"
              {...useFormField(form.control, 'code')}
            />
            <Input
              label={t('role.name')}
              isRequired
              isReadOnly={!canEdit}
              autoComplete="off"
              {...useFormField(form.control, 'name')}
            />
            <Textarea
              label={t('role.description')}
              rows={3}
              maxLength={1000}
              isReadOnly={!canEdit}
              className="md:col-span-2"
              {...useFormField(form.control, 'description')}
            />
            <NumberInput
              label={t('role.sortOrder')}
              hint={t('role.sortOrderHint')}
              isReadOnly={!canEdit}
              minValue={0}
              {...useFormField(form.control, 'sort_order')}
            />
          </div>
        </Card>

        <Card title={t('role.permissionsTitle')} headingLevel={2}>
          <PermissionMatrix
            roleName={title}
            catalogue={catalogue}
            selected={selected}
            {...(permissionsLocked ? {} : { onChange: setSelected })}
          />
        </Card>

        {canEdit ? (
          <div className="sticky bottom-0 z-(--z-sticky) -mx-3 flex flex-col-reverse gap-3 border-t border-line bg-canvas px-3 py-3 sm:mx-0 sm:flex-row sm:justify-end sm:px-0">
            <ButtonLink href="/admin/roles" variant="secondary">
              {t('role.backToList')}
            </ButtonLink>
            <Button type="submit" isPending={saving}>
              {isNew ? t('role.create') : t('role.save')}
            </Button>
          </div>
        ) : null}
      </form>

      {role ? (
        <RoleDialogs
          role={role}
          dialog={dialog}
          onClose={() => {
            setDialog(null);
          }}
          onRefused={setRefusal}
          onDeleted={() => {
            toast.success(t('role.deleted', { name: role.name }));
            void navigate('/admin/roles', { replace: true });
          }}
          usersLabel={format.number(role.user_count)}
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

function RoleActions({
  role,
  canEdit,
  canDelete,
  onOpen,
}: {
  readonly role: Role;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onOpen: (dialog: Dialog) => void;
}) {
  const { t } = useTranslation('admin');
  const active = role.status === 'active';
  return (
    <>
      {canEdit && !role.is_system ? (
        <Button
          variant="secondary"
          onPress={() => {
            onOpen('status');
          }}
        >
          {active ? t('role.deactivate') : t('role.reactivate')}
        </Button>
      ) : null}
      {canDelete ? (
        role.is_system ? (
          // Allowed for the role, forbidden by this record: shown disabled; the system-role notice gives the reason.
          <Button variant="danger" iconStart="trash" isDisabled>
            {t('role.delete')}
          </Button>
        ) : (
          <Button
            variant="danger"
            iconStart="trash"
            onPress={() => {
              onOpen('delete');
            }}
          >
            {t('role.delete')}
          </Button>
        )
      ) : null}
    </>
  );
}

function RoleDialogs({
  role,
  dialog,
  onClose,
  onRefused,
  onDeleted,
  usersLabel,
}: {
  readonly role: Role;
  readonly dialog: Dialog;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
  readonly onDeleted: () => void;
  readonly usersLabel: string;
}) {
  const { t } = useTranslation('admin');
  const setStatus = useSetRoleStatus(role);
  const remove = useDeleteRole(role);
  const active = role.status === 'active';

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      onClose();
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={dialog === 'status'}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        tone={active ? 'danger' : 'primary'}
        title={
          active
            ? t('role.deactivateTitle', { name: role.name })
            : t('role.reactivateTitle', { name: role.name })
        }
        consequence={active ? t('role.deactivateBody', { count: usersLabel }) : t('role.reactivateBody')}
        confirmLabel={active ? t('role.deactivate') : t('role.reactivate')}
        onConfirm={() =>
          run(async () => {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(
              active
                ? t('role.deactivated', { name: role.name })
                : t('role.reactivated', { name: role.name }),
            );
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        tone="danger"
        title={t('role.deleteTitle', { name: role.name })}
        consequence={t('role.deleteBody')}
        confirmLabel={t('role.delete')}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            onDeleted();
          })
        }
      />
    </>
  );
}

export { RoleEditorPage as Component };
