import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, ButtonLink, type DataColumn, DataTable, EmptyState, Link, PageHeader, Stack } from '@/ui';

import { useRolesList } from '../api/roles';
import { type Role } from '../api/schemas';
import { StatusBadge } from '../components/StatusBadge';

/** Admin → Roles & permissions (P1.01): every role, its users and how many permissions it grants. */
export function RolesPage() {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const canCreate = usePermission('role.create');
  const list = useRolesList();

  const columns: DataColumn<Role>[] = [
    {
      id: 'name',
      header: t('roles.columns.name'),
      isSortable: true,
      cell: (role) => <Link href={`/admin/roles/${role.id}`}>{role.name}</Link>,
    },
    {
      id: 'code',
      header: t('roles.columns.code'),
      isSortable: true,
      cell: (role) => <code className="font-mono text-sm">{role.code}</code>,
    },
    {
      id: 'user_count',
      header: t('roles.columns.users'),
      isNumeric: true,
      cell: (role) => format.number(role.user_count),
    },
    {
      id: 'permissions',
      header: t('roles.columns.permissions'),
      isNumeric: true,
      cell: (role) => format.number(role.permissions.length),
    },
    {
      id: 'type',
      header: t('roles.columns.type'),
      canHide: true,
      cell: (role) =>
        role.is_system ? <Badge tone="info" label={t('roles.system')} /> : <span>{t('roles.custom')}</span>,
    },
    { id: 'status', header: t('roles.columns.status'), cell: (role) => <StatusBadge status={role.status} /> },
  ];

  const add = canCreate ? (
    <ButtonLink href="/admin/roles/new" iconStart="plus">
      {t('roles.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('roles.title')} description={t('roles.description')} actions={add} />
      <DataTable
        label={t('roles.title')}
        columns={columns}
        getRowId={(role) => role.id}
        getRowLabel={(role) => role.name}
        storageKey="admin-roles"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('roles.itemLabel') }}
        emptyState={
          <EmptyState
            kind="new"
            title={t('roles.emptyTitle')}
            description={t('roles.emptyBody')}
            {...(add ? { action: add } : {})}
          />
        }
      />
    </Stack>
  );
}

export { RolesPage as Component };
