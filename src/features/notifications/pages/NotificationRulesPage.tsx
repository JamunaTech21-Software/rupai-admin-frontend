import { useState } from 'react';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  type DataColumn,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { type Rule, TRIGGER_TYPES, useRulesList, useTriggers } from '../api/notifications';
import { RuleFormModal } from '../components/RuleFormModal';
import { SeverityBadge } from '../components/SeverityBadge';

const ANY = 'any';
const TRIGGER = filterKey('trigger_type');
const ACTIVE = filterKey('is_active');

/**
 * Admin → Notification rules (P1.16, notification.view): which events notify whom, how soon before a date, by which
 * channel and how seriously. With notification.create a rule is added; with notification.edit it is changed or switched
 * off (there is no delete). An event whose module does not exist yet says when it will start to work.
 */
export function NotificationRulesPage() {
  const { t } = useTranslation('notifications');
  const canCreate = usePermission('notification.create');
  const canEdit = usePermission('notification.edit');
  const list = useRulesList();
  const triggers = useTriggers();
  const { table } = list;
  const [form, setForm] = useState<{ rule: Rule | null } | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const triggerLabel = (key: string) =>
    triggers.data?.find((candidate) => candidate.key === key)?.label ?? key;

  const columns: DataColumn<Rule>[] = [
    {
      id: 'rule',
      header: t('rules.columns.rule'),
      cell: (rule) => (
        <span className="flex flex-col">
          <span className="font-medium">{rule.name}</span>
          <span className="text-sm text-fg-muted">{rule.code}</span>
        </span>
      ),
    },
    {
      id: 'trigger',
      header: t('rules.columns.trigger'),
      cell: (rule) => (
        <span className="flex flex-col items-start gap-1">
          <span>{triggerLabel(rule.trigger_type)}</span>
          {rule.trigger.evaluated ? null : (
            <Badge tone="warning" label={t('rules.notActive', { module: rule.trigger.arrives_with ?? '' })} />
          )}
        </span>
      ),
    },
    {
      id: 'recipient',
      header: t('rules.columns.recipient'),
      canHide: true,
      cell: (rule) => {
        const who = rule.role?.name ?? rule.user?.username;
        return who
          ? `${t(`recipients.${rule.recipient_rule}`)}: ${who}`
          : t(`recipients.${rule.recipient_rule}`);
      },
    },
    {
      id: 'lead',
      header: t('rules.columns.lead'),
      align: 'end',
      canHide: true,
      cell: (rule) => (rule.lead_days === null ? '' : t('rules.days', { count: rule.lead_days })),
    },
    {
      id: 'channel',
      header: t('rules.columns.channel'),
      canHide: true,
      cell: (rule) => t(`channels.${rule.channel}`),
    },
    {
      id: 'severity',
      header: t('rules.columns.severity'),
      cell: (rule) => <SeverityBadge severity={rule.severity} />,
    },
    {
      id: 'status',
      header: t('rules.columns.status'),
      cell: (rule) =>
        rule.is_active ? (
          <Badge tone="success" label={t('rules.active')} />
        ) : (
          <Badge tone="draft" label={t('rules.inactive')} />
        ),
    },
    ...(canEdit
      ? [
          {
            id: 'actions',
            header: t('rules.columns.actions'),
            align: 'center',
            cell: (rule) => (
              <IconButton
                icon="edit"
                variant="ghost"
                size="sm"
                label={t('rules.edit', { name: rule.name })}
                onPress={() => {
                  setForm({ rule });
                }}
              />
            ),
          } satisfies DataColumn<Rule>,
        ]
      : []),
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('rules.title')}
        description={t('rules.description')}
        actions={
          canCreate ? (
            <Button
              iconStart="plus"
              onPress={() => {
                setForm({ rule: null });
              }}
            >
              {t('rules.add')}
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label={t('rules.title')}
        columns={columns}
        getRowId={(rule) => rule.id}
        getRowLabel={(rule) => rule.name}
        storageKey="notification-rules"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('rules.itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('rules.filters.trigger')}
              className="w-full sm:w-64"
              value={table.filters[TRIGGER] ?? ANY}
              options={[
                { id: ANY, label: t('rules.filters.anyTrigger') },
                ...TRIGGER_TYPES.map((key) => ({ id: key, label: triggerLabel(key) })),
              ]}
              onChange={(value) => {
                table.setFilter(TRIGGER, value === null || value === ANY ? null : value);
              }}
            />
            <Select
              label={t('rules.filters.status')}
              className="w-full sm:w-44"
              value={table.filters[ACTIVE] ?? ANY}
              options={[
                { id: ANY, label: t('rules.filters.anyStatus') },
                { id: 'true', label: t('rules.active') },
                { id: 'false', label: t('rules.inactive') },
              ]}
              onChange={(value) => {
                table.setFilter(ACTIVE, value === null || value === ANY ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('rules.emptyFilteredTitle')}
              description={t('rules.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('rules.emptyTitle')} description={t('rules.emptyBody')} />
          )
        }
      />
      {form ? (
        <RuleFormModal
          rule={form.rule}
          onClose={() => {
            setForm(null);
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

export { NotificationRulesPage as Component };
