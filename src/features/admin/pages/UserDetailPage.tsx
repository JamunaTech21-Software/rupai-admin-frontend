import { lazy, Suspense, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import {
  Button,
  Card,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  Inline,
  PageHeader,
  Stack,
  Tabs,
  toast,
} from '@/ui';

import { usePermissionCatalogue } from '../api/roles';
import { type User } from '../api/schemas';
import { useDeleteUser, useSetUserStatus, useUser, useUserPermissions } from '../api/users';
import { PermissionMatrix } from '../components/PermissionMatrix';
import { StatusBadge } from '../components/StatusBadge';

// Opened on demand; the role picker carries the date picker, which this page does not otherwise need.
const UserEditModal = lazy(() =>
  import('../components/UserEditModal').then((m) => ({ default: m.UserEditModal })),
);
const UserRolesModal = lazy(() =>
  import('../components/UserRolesModal').then((m) => ({ default: m.UserRolesModal })),
);

type Dialog = 'edit' | 'roles' | 'status' | 'delete' | null;

function ProfileTab({ user }: { readonly user: User }) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const yesNo = (value: boolean) => (value ? t('user.yes') : t('user.no'));
  return (
    <Card>
      <DescriptionList
        columns={2}
        items={[
          { term: t('user.username'), description: user.username },
          { term: t('user.email'), description: user.email },
          { term: t('user.phone'), description: user.phone },
          { term: t('users.columns.status'), description: <StatusBadge status={user.status} /> },
          { term: t('user.mustChange'), description: yesNo(user.must_change_password) },
          { term: t('user.twoFactor'), description: yesNo(user.two_factor_enabled) },
          {
            term: t('user.lastLogin'),
            description: user.last_login_at ? format.dateTime(user.last_login_at) : t('users.never'),
          },
          {
            term: t('user.locked'),
            description: user.locked_until ? format.dateTime(user.locked_until) : null,
          },
          { term: t('user.createdAt'), description: format.dateTime(user.created_at) },
          {
            term: t('user.updatedAt'),
            description: user.updated_at ? format.dateTime(user.updated_at) : null,
          },
        ]}
      />
    </Card>
  );
}

function RolesTab({
  user,
  canEdit,
  onChange,
}: {
  readonly user: User;
  readonly canEdit: boolean;
  readonly onChange: () => void;
}) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  return (
    <Stack gap={4}>
      <Inline justify="between" gap={3}>
        <p className="max-w-prose text-fg-muted">{t('user.rolesIntro')}</p>
        {canEdit ? (
          <Button variant="secondary" iconStart="edit" onPress={onChange}>
            {t('user.changeRoles')}
          </Button>
        ) : null}
      </Inline>
      {user.roles.length === 0 ? (
        <Card>
          <EmptyState kind="new" title={t('user.noRolesTitle')} description={t('user.noRolesBody')} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {user.roles.map((role) => (
            <li key={role.id} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-fg">{role.name}</span>
                {role.status === 'inactive' ? <StatusBadge status="inactive" /> : null}
              </span>
              <span className="text-sm text-fg-muted">{role.code}</span>
              <span className="text-sm text-fg-muted">
                {t('user.grantedOn', { date: format.dateTime(role.granted_at) })}
                {' · '}
                {role.expires_at
                  ? t('user.expiresOn', { date: format.dateTime(role.expires_at) })
                  : t('user.noExpiry')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

function PermissionsTab({ user }: { readonly user: User }) {
  const { t } = useTranslation('admin');
  const effective = useUserPermissions(user.id);
  const catalogue = usePermissionCatalogue();
  if (effective.isPending || catalogue.isPending) return <PageLoading rows={4} />;
  if (effective.isError)
    return <PageError error={effective.error} onRetry={() => void effective.refetch()} />;
  if (catalogue.isError)
    return <PageError error={catalogue.error} onRetry={() => void catalogue.refetch()} />;
  const granted = new Set(effective.data.permissions);
  return (
    <Stack gap={4}>
      <p className="text-fg-muted">
        {t('user.effectiveIntro')} {t('user.permissionCount', { count: granted.size })}
      </p>
      {granted.size === 0 ? (
        <Card>
          <EmptyState
            kind="new"
            title={t('user.noPermissionsTitle')}
            description={t('user.noPermissionsBody')}
          />
        </Card>
      ) : (
        <PermissionMatrix
          roleName={user.username}
          catalogue={catalogue.data}
          selected={granted}
          defaultOnlySelected
        />
      )}
    </Stack>
  );
}

/** Admin → Users → one user: profile, roles (with the role picker) and effective permissions. */
export function UserDetailPage() {
  const { t } = useTranslation('admin');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useUser(id);
  const canEdit = usePermission('user.edit');
  const canDelete = usePermission('user.delete');
  const tab = useUrlTab('tab', 'profile');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const user = query.data;

  return (
    <UserDetail
      user={user}
      canEdit={canEdit}
      canDelete={canDelete}
      tab={tab}
      dialog={dialog}
      setDialog={setDialog}
      refusal={refusal}
      setRefusal={setRefusal}
      onDeleted={() => {
        toast.success(t('user.deleted', { username: user.username }));
        void navigate('/admin/users', { replace: true });
      }}
    />
  );
}

interface UserDetailProps {
  readonly user: User;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly tab: ReturnType<typeof useUrlTab>;
  readonly dialog: Dialog;
  readonly setDialog: (dialog: Dialog) => void;
  readonly refusal: unknown;
  readonly setRefusal: (error: unknown) => void;
  readonly onDeleted: () => void;
}

function UserDetail({
  user,
  canEdit,
  canDelete,
  tab,
  dialog,
  setDialog,
  refusal,
  setRefusal,
  onDeleted,
}: UserDetailProps) {
  const { t } = useTranslation('admin');
  const setStatus = useSetUserStatus(user);
  const remove = useDeleteUser(user);
  const active = user.status === 'active';
  const close = () => {
    setDialog(null);
  };

  /** A refusal (or a conflict, which has its own dialog) after a confirm: rethrown only to keep it open. */
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      setDialog(null);
      if (errorBehaviour(error) !== 'conflict') setRefusal(error);
    }
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title={user.username}
        status={{ tone: active ? 'success' : 'neutral', label: t(`status.${user.status}`) }}
        description={user.email ?? undefined}
        breadcrumbs={[{ label: t('user.backToList'), href: '/admin/users' }, { label: user.username }]}
        actions={
          canEdit || canDelete ? (
            <>
              {canEdit ? (
                <Button
                  variant="secondary"
                  iconStart="edit"
                  onPress={() => {
                    setDialog('edit');
                  }}
                >
                  {t('user.edit')}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setDialog('status');
                  }}
                >
                  {active ? t('user.deactivate') : t('user.reactivate')}
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="danger"
                  iconStart="trash"
                  onPress={() => {
                    setDialog('delete');
                  }}
                >
                  {t('user.delete')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {!canEdit ? <PermissionNotice /> : null}
      <Tabs
        label={t('user.tabsLabel')}
        {...tab}
        items={[
          { id: 'profile', label: t('user.tabs.profile'), content: <ProfileTab user={user} /> },
          {
            id: 'roles',
            label: t('user.tabs.roles'),
            count: user.roles.length,
            content: (
              <RolesTab
                user={user}
                canEdit={canEdit}
                onChange={() => {
                  setDialog('roles');
                }}
              />
            ),
          },
          { id: 'permissions', label: t('user.tabs.permissions'), content: <PermissionsTab user={user} /> },
        ]}
      />

      <Suspense fallback={null}>
        {dialog === 'edit' ? (
          <UserEditModal user={user} isOpen onClose={close} onRefused={setRefusal} />
        ) : null}
        {dialog === 'roles' ? (
          <UserRolesModal user={user} isOpen onClose={close} onRefused={setRefusal} />
        ) : null}
      </Suspense>
      <ConfirmDialog
        isOpen={dialog === 'status'}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        tone={active ? 'danger' : 'primary'}
        title={
          active
            ? t('user.deactivateTitle', { username: user.username })
            : t('user.reactivateTitle', { username: user.username })
        }
        consequence={
          active
            ? t('user.deactivateBody', { username: user.username })
            : t('user.reactivateBody', { username: user.username })
        }
        confirmLabel={active ? t('user.deactivate') : t('user.reactivate')}
        onConfirm={() =>
          run(async () => {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(
              active
                ? t('user.deactivated', { username: user.username })
                : t('user.reactivated', { username: user.username }),
            );
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        tone="danger"
        title={t('user.deleteTitle', { username: user.username })}
        consequence={t('user.deleteBody')}
        confirmLabel={t('user.delete')}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            onDeleted();
          })
        }
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { UserDetailPage as Component };
