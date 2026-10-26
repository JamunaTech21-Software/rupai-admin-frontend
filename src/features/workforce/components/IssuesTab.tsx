import { useState } from 'react';

import { ScopeNotice, useAllEstates } from '@/features/organisation';
import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  type BadgeTone,
  Button,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  Link,
  Modal,
  Select,
  toast,
} from '@/ui';

import {
  type BenefitIssue,
  ISSUE_STATES,
  useDeleteIssue,
  useGenerateIssues,
  useIssuesList,
  useSubmitIssue,
} from '../api/benefits';
import { LookupPick } from './LookupPick';

const ESTATE = filterKey('estate_id');
const STATE = filterKey('state');
const TONES: Record<BenefitIssue['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};
const todayIso = () => new Date().toISOString().slice(0, 10);
const NONE = 'none';

/** Draft this period's issues for every current entitlement of a benefit in an estate (the week's ration). */
export function GenerateIssuesDialog({
  onClose,
  onRefused,
}: {
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const estates = useAllEstates();
  const generate = useGenerateIssues();
  const [type, setType] = useState<string | null>(null);
  const [estate, setEstate] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(todayIso());
  const [period, setPeriod] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async () => {
    const found: Record<string, string> = {};
    if (type === null) found.type = t('validation.benefitType');
    if (estate === null) found.estate = t('validation.estate');
    if (date === null) found.date = t('validation.issueDate');
    setErrors(found);
    if (Object.keys(found).length > 0 || type === null || estate === null || date === null) return;
    try {
      const result = await generate.mutateAsync({
        benefit_type_id: type,
        estate_id: estate,
        issue_date: date,
        period_reference: period.trim() === '' ? null : period.trim(),
      });
      toast.success(t('issues.generated', { created: result.created, existing: result.existing }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      onRefused(error);
      onClose();
    }
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('issues.generateTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={generate.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('issues.generate')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <p className="text-sm text-fg-muted sm:col-span-2">{t('issues.generateHint')}</p>
        <LookupPick
          type="benefit_type"
          label={t('benefits.type')}
          value={type}
          current={null}
          onChange={setType}
          error={errors.type}
        />
        <Select
          label={t('benefits.estateFilter')}
          placeholder={t('form.select')}
          isRequired
          value={estate ?? NONE}
          options={(estates.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }))}
          onChange={(next) => {
            setEstate(next === null || next === NONE ? null : next);
          }}
          {...(errors.estate ? { error: errors.estate } : {})}
        />
        <DatePicker
          label={t('issues.issueDate')}
          isRequired
          value={date}
          onChange={setDate}
          {...(errors.date ? { error: errors.date } : {})}
        />
        <Input
          label={t('issues.period')}
          placeholder={t('issues.placeholders.period')}
          value={period}
          onChange={setPeriod}
        />
      </div>
    </Modal>
  );
}

/** Submit or delete one draft issue. */
function IssueActions({
  issue,
  onRefused,
}: {
  readonly issue: BenefitIssue;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canSubmit = usePermission('benefit.submit');
  const canDelete = usePermission('benefit.delete');
  const submit = useSubmitIssue(issue.profile.full_name);
  const remove = useDeleteIssue();
  const [confirming, setConfirming] = useState(false);
  const name = issue.profile.full_name;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {issue.state === 'draft' && canSubmit ? (
        <Button
          size="sm"
          isPending={submit.isPending}
          onPress={() => {
            void submit
              .mutateAsync(issue)
              .then(() => {
                toast.success(t('issues.sent', { name }));
              })
              .catch((error: unknown) => {
                if (errorBehaviour(error) !== 'conflict') onRefused(error);
              });
          }}
        >
          {t('benefits.submit')}
          <span className="sr-only"> {name}</span>
        </Button>
      ) : null}
      {issue.state === 'draft' && canDelete ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setConfirming(true);
            }}
          >
            {t('benefits.delete')}
            <span className="sr-only"> {name}</span>
          </Button>
          <ConfirmDialog
            isOpen={confirming}
            onOpenChange={setConfirming}
            title={t('issues.deleteTitle', { name })}
            consequence={t('issues.deleteBody')}
            confirmLabel={t('benefits.delete')}
            tone="danger"
            onConfirm={async () => {
              try {
                await remove.mutateAsync(issue);
                toast.success(t('issues.deleted', { name }));
              } catch (error) {
                onRefused(error);
              }
              setConfirming(false);
            }}
          />
        </>
      ) : null}
      {issue.state === 'submitted' && issue.approval_id ? (
        <Link href={`/approvals/${issue.approval_id}`}>
          {t('benefits.openApproval')}
          <span className="sr-only"> {name}</span>
        </Link>
      ) : null}
    </span>
  );
}

/**
 * What has been given (benefit.view): each issue with its person, benefit, date, quantity and cost, and where it
 * stands. "Generate" drafts a period's issues for everyone entitled (benefit.create); each is then submitted.
 */
export function IssuesTab() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const list = useIssuesList();
  const estates = useAllEstates();
  const [refusal, setRefusal] = useState<unknown>(null);
  const { table } = list;

  const columns: DataColumn<BenefitIssue>[] = [
    {
      id: 'employee',
      header: t('benefits.columns.employee'),
      cell: (i) => (
        <span className="flex flex-col">
          <span className="font-medium">{i.profile.full_name}</span>
          <span className="font-mono text-sm text-fg-muted">{i.profile.profile_number}</span>
        </span>
      ),
    },
    { id: 'type', header: t('benefits.columns.type'), cell: (i) => i.benefit_type.name },
    {
      id: 'date',
      header: t('issues.columns.date'),
      isSortable: true,
      cell: (i) => format.date(i.issue_date),
    },
    {
      id: 'period',
      header: t('issues.columns.period'),
      canHide: true,
      cell: (i) => i.period_reference ?? <span className="text-fg-subtle">—</span>,
    },
    {
      id: 'quantity',
      header: t('benefits.columns.quantity'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (i) => (i.quantity ? format.decimal(i.quantity, 1) : <span className="text-fg-subtle">—</span>),
    },
    {
      id: 'cost',
      header: t('issues.columns.cost'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (i) => format.money(i.employer_cost),
    },
    {
      id: 'state',
      header: t('benefits.columns.state'),
      align: 'center',
      cell: (i) => <Badge tone={TONES[i.state]} label={t(`entitlementStates.${i.state}`)} />,
    },
    {
      id: 'actions',
      header: t('benefits.columns.actions'),
      cell: (i) => <IssueActions issue={i} onRefused={setRefusal} />,
    },
  ];

  const select = (
    key: string,
    label: string,
    any: string,
    options: readonly { id: string; label: string }[],
  ) => (
    <Select
      label={label}
      className="w-full sm:w-44"
      value={table.filters[key] ?? 'any'}
      options={[{ id: 'any', label: any }, ...options]}
      onChange={(value) => {
        table.setFilter(key, value === 'any' ? null : value);
      }}
    />
  );

  return (
    <>
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('issues.title')}
        columns={columns}
        getRowId={(i) => i.id}
        getRowLabel={(i) => `${i.profile.full_name} · ${i.benefit_type.name}`}
        storageKey="hr-benefit-issues"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('issues.itemLabel') }}
        toolbar={
          <>
            {select(
              ESTATE,
              t('benefits.estateFilter'),
              t('benefits.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              ISSUE_STATES.map((value) => ({ id: value, label: t(`entitlementStates.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('benefits.emptyFilteredTitle')}
              description={t('benefits.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('benefits.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('issues.emptyTitle')} description={t('issues.emptyBody')} />
          )
        }
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </>
  );
}
