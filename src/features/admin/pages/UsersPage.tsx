import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Button,
  ButtonLink,
  type DataColumn,
  DataTable,
  EmptyState,
  Input,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { useAllRoles } from '../api/roles';
import { type User } from '../api/schemas';
import { useUsersList } from '../api/users';
import { StatusBadge } from '../components/StatusBadge';

const SEARCH = filterKey('username', 'like');
const STATUS = filterKey('status');
const ROLE = filterKey('role_id');

/** Admin → Users (P1.01): everyone who can sign in, filterable by name, status and role; state in the URL. */
export function UsersPage() {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const canCreate = usePermission('user.create');
  const list = useUsersList();
  const roles = useAllRoles();
  const { table } = list;

  const columns: DataColumn<User>[] = [
    {
      id: 'username',
      header: t('users.columns.username'),
      isSortable: true,
      cell: (user) => <Link href={`/admin/users/${user.id}`}>{user.username}</Link>,
    },
    { id: 'email', header: t('users.columns.email'), isSortable: true, cell: (user) => user.email ?? '' },
    {
      id: 'roles',
      header: t('users.columns.roles'),
      canHide: true,
      cell: (user) =>
        user.roles.length === 0 ? (
          <span className="text-fg-muted">{t('users.noRoles')}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <span key={role.id} className="rounded-full bg-surface-subtle px-2 py-0.5 text-sm text-fg">
                {role.name}
              </span>
            ))}
          </span>
        ),
    },
    { id: 'status', header: t('users.columns.status'), cell: (user) => <StatusBadge status={user.status} /> },
    {
      id: 'last_login_at',
      header: t('users.columns.lastLogin'),
      canHide: true,
      cell: (user) => (user.last_login_at ? format.dateTime(user.last_login_at) : t('users.never')),
    },
  ];

  const roleOptions = [
    { id: 'any', label: t('users.anyRole') },
    ...(roles.data ?? []).map((role) => ({ id: role.id, label: role.name })),
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          canCreate ? (
            <ButtonLink href="/admin/users/new" iconStart="plus">
              {t('users.add')}
            </ButtonLink>
          ) : undefined
        }
      />
      <DataTable
        label={t('users.title')}
        columns={columns}
        getRowId={(user) => user.id}
        getRowLabel={(user) => user.username}
        storageKey="admin-users"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('users.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('users.search')}
              placeholder={t('users.searchPlaceholder')}
              className="w-full sm:w-56"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            <Select
              label={t('users.statusFilter')}
              className="w-full sm:w-40"
              value={table.filters[STATUS] ?? 'any'}
              options={[
                { id: 'any', label: t('users.anyStatus') },
                { id: 'active', label: t('status.active') },
                { id: 'disabled', label: t('status.disabled') },
              ]}
              onChange={(value) => {
                table.setFilter(STATUS, value === 'any' ? null : value);
              }}
            />
            <Select
              label={t('users.roleFilter')}
              className="w-full sm:w-48"
              value={table.filters[ROLE] ?? 'any'}
              options={roleOptions}
              onChange={(value) => {
                table.setFilter(ROLE, value === 'any' ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('users.emptyFilteredTitle')}
              description={t('users.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('users.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('users.emptyNewTitle')}
              description={t('users.emptyNewBody')}
              {...(canCreate
                ? {
                    action: (
                      <ButtonLink href="/admin/users/new" iconStart="plus">
                        {t('users.add')}
                      </ButtonLink>
                    ),
                  }
                : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { UsersPage as Component };
