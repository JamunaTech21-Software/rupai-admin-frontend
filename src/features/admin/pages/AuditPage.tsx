import { useSearchParams } from 'react-router';

import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import { type BusinessDate } from '@/types';
import {
  Badge,
  type BadgeTone,
  type DataColumn,
  DataTable,
  DateRangePicker,
  EmptyState,
  Icon,
  Link,
  PageHeader,
  Select,
  Stack,
  Tabs,
} from '@/ui';

import {
  ACCESS_EVENTS,
  type AccessEvent,
  type AccessLogEntry,
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditChange,
  RECORD_TYPES,
  SECURITY_EVENTS,
  useAccessLog,
  useAuditChanges,
} from '../api/audit';
import { useUserDirectory } from '../api/users';
import { AuditValue } from '../components/AuditValue';
import { dhakaDate, endOfDhakaDay, moduleLabel, startOfDhakaDay } from '../labels';

type Table = ReturnType<typeof useAuditChanges>['table'];

const ACTION_TONE: Partial<Record<AuditAction, BadgeTone>> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
};
const SECURITY = new Set<string>(SECURITY_EVENTS);
const SECURITY_FILTER = SECURITY_EVENTS.join(',');

/** Records with a page of their own get a link. */
const RECORD_PAGES: Readonly<Record<string, string>> = { user: '/admin/users/', role: '/admin/roles/' };

/** The required period, as business dates in Dhaka. Clearing it returns to the default (the last 7 days). */
function PeriodFilter({
  table,
  field,
}: {
  readonly table: Table;
  readonly field: 'changed_at' | 'occurred_at';
}) {
  const { t } = useTranslation('admin');
  const fromKey = filterKey(field, 'from');
  const toKey = filterKey(field, 'to');
  const from = table.filters[fromKey];
  const to = table.filters[toKey];
  return (
    <DateRangePicker
      label={t('audit.period')}
      hint={t('audit.periodHint')}
      className="w-full sm:w-auto"
      value={
        from && to ? { start: dhakaDate(from) as BusinessDate, end: dhakaDate(to) as BusinessDate } : null
      }
      onChange={(range) => {
        table.setFilters(
          range
            ? { [fromKey]: startOfDhakaDay(range.start), [toKey]: endOfDhakaDay(range.end) }
            : { [fromKey]: null, [toKey]: null },
        );
      }}
    />
  );
}

/** A user filter from the user directory. */
function UserFilter({
  table,
  filter,
  label,
}: {
  readonly table: Table;
  readonly filter: string;
  readonly label: string;
}) {
  const { t } = useTranslation('admin');
  const directory = useUserDirectory();
  const options = [
    { id: 'any', label: t('audit.anyone') },
    ...[...(directory.data ?? new Map<string, string>())].map(([id, username]) => ({ id, label: username })),
  ];
  return (
    <Select
      label={label}
      className="w-full sm:w-44"
      value={table.filters[filter] ?? 'any'}
      options={options}
      onChange={(value) => {
        table.setFilter(filter, value === 'any' ? null : value);
      }}
    />
  );
}

function ChangesTab() {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const list = useAuditChanges();
  const { table } = list;
  const recordLabel = (type: string) =>
    (RECORD_TYPES as readonly string[]).includes(type)
      ? t(`audit.recordTypes.${type as (typeof RECORD_TYPES)[number]}`)
      : type;

  const columns: DataColumn<AuditChange>[] = [
    {
      id: 'changed_at',
      header: t('audit.columns.when'),
      cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.changed_at)}</span>,
    },
    {
      id: 'changed_by',
      header: t('audit.columns.who'),
      cell: (row) => row.changed_by?.username ?? <span className="text-fg-muted">{t('audit.system')}</span>,
    },
    {
      id: 'record',
      header: t('audit.columns.record'),
      cell: (row) => {
        const label = `${recordLabel(row.record_type)} #${row.record_id}`;
        const page = RECORD_PAGES[row.record_type];
        return page ? <Link href={`${page}${row.record_id}`}>{label}</Link> : label;
      },
    },
    {
      id: 'action',
      header: t('audit.columns.action'),
      cell: (row) => (
        <Badge tone={ACTION_TONE[row.action] ?? 'neutral'} label={t(`audit.actions.${row.action}`)} />
      ),
    },
    {
      id: 'field',
      header: t('audit.columns.field'),
      cell: (row) =>
        row.field ? moduleLabel(row.field) : <span className="text-fg-muted">{t('audit.wholeRecord')}</span>,
    },
    {
      id: 'old_value',
      header: t('audit.columns.before'),
      cell: (row) => <AuditValue value={row.old_value} tone="old" />,
    },
    {
      id: 'new_value',
      header: t('audit.columns.after'),
      cell: (row) => <AuditValue value={row.new_value} tone="new" />,
    },
    {
      id: 'reason',
      header: t('audit.columns.reason'),
      canHide: true,
      cell: (row) => row.reason ?? '',
    },
  ];

  return (
    <DataTable
      label={t('audit.changesTitle')}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => `${recordLabel(row.record_type)} #${row.record_id} ${row.field ?? ''}`}
      storageKey="admin-audit-changes"
      {...list.tableProps}
      toolbar={
        <>
          <PeriodFilter table={table} field="changed_at" />
          <Select
            label={t('audit.recordType')}
            className="w-full sm:w-48"
            value={table.filters[filterKey('record_type')] ?? 'any'}
            options={[
              { id: 'any', label: t('audit.anyRecord') },
              ...RECORD_TYPES.map((type) => ({ id: type, label: t(`audit.recordTypes.${type}`) })),
            ]}
            onChange={(value) => {
              table.setFilter(filterKey('record_type'), value === 'any' ? null : value);
            }}
          />
          <Select
            label={t('audit.action')}
            className="w-full sm:w-40"
            value={table.filters[filterKey('action')] ?? 'any'}
            options={[
              { id: 'any', label: t('audit.anyAction') },
              ...AUDIT_ACTIONS.map((action) => ({ id: action, label: t(`audit.actions.${action}`) })),
            ]}
            onChange={(value) => {
              table.setFilter(filterKey('action'), value === 'any' ? null : value);
            }}
          />
          <UserFilter table={table} filter={filterKey('changed_by')} label={t('audit.changedBy')} />
        </>
      }
      emptyState={
        <EmptyState
          kind="no-results"
          title={t('audit.noChangesTitle')}
          description={t('audit.noChangesBody')}
        />
      }
    />
  );
}

function AccessTab() {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const list = useAccessLog();
  const { table } = list;
  const eventKey = filterKey('event_type');
  const securityKey = filterKey('event_type', 'in');
  const eventValue =
    table.filters[securityKey] === SECURITY_FILTER ? 'security' : (table.filters[eventKey] ?? 'any');

  const eventBadge = (event: AccessEvent) => {
    const label = t(`audit.events.${event}`);
    if (SECURITY.has(event)) {
      return (
        <span className="inline-flex items-center gap-1">
          <Icon name="alert" size="sm" className="text-danger" label={t('audit.securityEvent')} />
          <Badge tone="danger" label={label} />
        </span>
      );
    }
    return <Badge tone={event === 'failed_login' ? 'warning' : 'neutral'} label={label} />;
  };

  const columns: DataColumn<AccessLogEntry>[] = [
    {
      id: 'occurred_at',
      header: t('audit.columns.when'),
      cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.occurred_at)}</span>,
    },
    {
      id: 'user',
      header: t('audit.columns.user'),
      cell: (row) =>
        row.user ? (
          <Link href={`/admin/users/${row.user.id}`}>{row.user.username}</Link>
        ) : (
          <span className="text-fg-muted">{t('audit.unknownUser')}</span>
        ),
    },
    { id: 'event_type', header: t('audit.columns.event'), cell: (row) => eventBadge(row.event_type) },
    { id: 'module', header: t('audit.columns.module'), canHide: true, cell: (row) => row.module ?? '' },
    {
      id: 'record_reference',
      header: t('audit.columns.recordRef'),
      canHide: true,
      cell: (row) => row.record_reference ?? '',
    },
    {
      id: 'ip_address',
      header: t('audit.columns.ip'),
      canHide: true,
      cell: (row) => row.ip_address?.replace(/^::ffff:/, '') ?? '',
    },
    {
      id: 'detail',
      header: t('audit.columns.detail'),
      canHide: true,
      cell: (row) => (row.detail ? <AuditValue value={JSON.stringify(row.detail)} tone="new" /> : ''),
    },
  ];

  return (
    <DataTable
      label={t('audit.accessTitle')}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => `${t(`audit.events.${row.event_type}`)} ${row.user?.username ?? ''}`}
      storageKey="admin-audit-access"
      {...list.tableProps}
      toolbar={
        <>
          <PeriodFilter table={table} field="occurred_at" />
          <Select
            label={t('audit.event')}
            className="w-full sm:w-56"
            value={eventValue}
            options={[
              { id: 'any', label: t('audit.anyEvent') },
              { id: 'security', label: t('audit.securityOnly') },
              ...ACCESS_EVENTS.map((event) => ({ id: event, label: t(`audit.events.${event}`) })),
            ]}
            onChange={(value) => {
              table.setFilters({
                [eventKey]: value === 'any' || value === 'security' ? null : value,
                [securityKey]: value === 'security' ? SECURITY_FILTER : null,
              });
            }}
          />
          <UserFilter table={table} filter={filterKey('user_id')} label={t('audit.columns.user')} />
        </>
      }
      emptyState={
        <EmptyState
          kind="no-results"
          title={t('audit.noAccessTitle')}
          description={t('audit.noAccessBody')}
        />
      }
    />
  );
}

/** Admin → Audit (P1.05): who changed what (field by field), and who signed in, was refused or exported. */
export function AuditPage() {
  const { t } = useTranslation('admin');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'access' ? 'access' : 'changes';

  return (
    <Stack gap={6}>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      <Tabs
        label={t('audit.title')}
        selectedKey={tab}
        onSelectionChange={(key) => {
          // Each tab has its own filters: switching starts the other one fresh.
          setParams(key === 'access' ? { tab: 'access' } : {}, { replace: true });
        }}
        items={[
          { id: 'changes', label: t('audit.changesTitle'), content: <ChangesTab /> },
          { id: 'access', label: t('audit.accessTitle'), content: <AccessTab /> },
        ]}
      />
    </Stack>
  );
}

export { AuditPage as Component };
