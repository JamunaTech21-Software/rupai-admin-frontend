import { useState } from 'react';

import { useAllEstates, useAllFiscalYears } from '@/features/organisation';
import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  Button,
  ButtonLink,
  type DataColumn,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import {
  type Entitlement,
  useAdjustEntitlement,
  useEntitlements,
  useGenerateEntitlements,
} from '../api/leave';

const ANY = 'any';

/** Replace one entitlement's adjustment (leave.approve): days, which may be negative, and why. */
function AdjustDialog({
  entitlement,
  onClose,
  onRefused,
}: {
  readonly entitlement: Entitlement;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const subject = `${entitlement.profile.full_name} · ${entitlement.leave_type.name}`;
  const adjust = useAdjustEntitlement(entitlement, subject);
  const [days, setDays] = useState(new Dec(entitlement.adjustment_days).toString());
  const [reason, setReason] = useState(entitlement.adjustment_reason ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!/^-?\d{1,3}(\.\d{1,4})?$/.test(days.trim())) found.adjustment_days = t('validation.days');
    if (reason.trim().length < 3) found.reason = t('validation.reason');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await adjust.mutateAsync({ adjustment_days: days.trim(), reason: reason.trim() });
      toast.success(t('balances.adjusted', { name: entitlement.profile.full_name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of error.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
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
      title={t('balances.adjustTitle', { name: subject })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={adjust.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('balances.adjust')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Input
          label={t('balances.adjustment')}
          hint={t('balances.adjustmentHint')}
          isRequired
          value={days}
          onChange={setDays}
          {...(errors.adjustment_days ? { error: errors.adjustment_days } : {})}
        />
        <Textarea
          label={t('actions.reason')}
          placeholder={t('actions.reasonPlaceholder')}
          rows={3}
          maxLength={300}
          isRequired
          value={reason}
          onChange={setReason}
          {...(errors.reason ? { error: errors.reason } : {})}
        />
      </div>
    </Modal>
  );
}

/**
 * HR → Leave balances (P2.07): each person's entitlement per leave type for a fiscal year: entitled, carried forward,
 * adjusted, taken, waiting and what is left to ask for. A worker sees their own. Those who may create leave can make a
 * year's entitlements; those who may approve can adjust one.
 */
export function LeaveBalancesPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canGenerate = usePermission('leave.create');
  const canAdjust = usePermission('leave.approve');
  const years = useAllFiscalYears();
  const estates = useAllEstates();
  const [year, setYear] = useState<string>(ANY);
  const [estate, setEstate] = useState<string>(ANY);
  const [adjusting, setAdjusting] = useState<Entitlement | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const generate = useGenerateEntitlements();
  const list = useEntitlements({
    ...(year === ANY ? {} : { fiscalYearId: year }),
    ...(estate === ANY ? {} : { estateId: estate }),
  });
  const rows = list.data ?? [];
  const n = (value: string) => format.decimal(value, 1);

  const columns: DataColumn<Entitlement>[] = [
    {
      id: 'employee',
      header: t('balances.columns.employee'),
      cell: (e) => (
        <span className="flex flex-col">
          <span className="font-medium">{e.profile.full_name}</span>
          <span className="font-mono text-sm text-fg-muted">{e.profile.profile_number}</span>
        </span>
      ),
    },
    { id: 'type', header: t('balances.columns.type'), cell: (e) => e.leave_type.name },
    { id: 'year', header: t('balances.columns.year'), canHide: true, cell: (e) => e.fiscal_year.code },
    {
      id: 'entitled',
      header: t('balances.columns.entitled'),
      isNumeric: true,
      align: 'end',
      cell: (e) => n(e.entitled_days),
    },
    {
      id: 'carried',
      header: t('balances.columns.carried'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (e) => n(e.carried_forward_days),
    },
    {
      id: 'adjustment',
      header: t('balances.columns.adjustment'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (e) => n(e.adjustment_days),
    },
    {
      id: 'taken',
      header: t('balances.columns.taken'),
      isNumeric: true,
      align: 'end',
      cell: (e) => n(e.consumed_days),
    },
    {
      id: 'pending',
      header: t('balances.columns.pending'),
      isNumeric: true,
      align: 'end',
      cell: (e) => n(e.pending_days),
    },
    {
      id: 'balance',
      header: t('balances.columns.balance'),
      isNumeric: true,
      align: 'end',
      cell: (e) => n(e.balance_days),
    },
    {
      id: 'available',
      header: t('balances.columns.available'),
      isNumeric: true,
      align: 'end',
      cell: (e) => <span className="font-medium">{n(e.available_to_request)}</span>,
    },
    ...(canAdjust
      ? [
          {
            id: 'actions',
            header: t('balances.columns.actions'),
            cell: (e: Entitlement) => (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setAdjusting(e);
                }}
              >
                {t('balances.adjust')}
                <span className="sr-only">
                  {' '}
                  {e.profile.full_name} {e.leave_type.name}
                </span>
              </Button>
            ),
          } satisfies DataColumn<Entitlement>,
        ]
      : []),
  ];

  const runGenerate = () => {
    void generate
      .mutateAsync({ fiscal_year_id: year, ...(estate === ANY ? {} : { estate_id: estate }) })
      .then((result) => {
        toast.success(t('balances.generated', { created: result.created, existing: result.existing }));
      })
      .catch((error: unknown) => {
        if (errorBehaviour(error) !== 'conflict') setRefusal(error);
      });
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('balances.title')}
        description={t('balances.description')}
        breadcrumbs={[{ label: t('leave.title'), href: '/hr/leave' }, { label: t('balances.title') }]}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/hr/leave" variant="secondary">
              {t('balances.requests')}
            </ButtonLink>
            {canGenerate ? (
              <Button
                variant="secondary"
                isDisabled={year === ANY}
                isPending={generate.isPending}
                onPress={runGenerate}
              >
                {t('balances.generate')}
              </Button>
            ) : null}
          </span>
        }
      />
      <DataTable
        label={t('balances.title')}
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        getRowLabel={(e) => `${e.profile.full_name} · ${e.leave_type.name}`}
        storageKey="hr-leave-balances"
        isLoading={list.isPending}
        error={list.isError ? { message: t('balances.failed'), onRetry: () => void list.refetch() } : null}
        toolbar={
          <>
            <Select
              label={t('balances.year')}
              className="w-full sm:w-44"
              value={year}
              options={[
                { id: ANY, label: t('balances.anyYear') },
                ...(years.data ?? []).map((fy) => ({ id: fy.id, label: fy.code })),
              ]}
              onChange={(next) => {
                setYear(next ?? ANY);
              }}
            />
            <Select
              label={t('balances.estate')}
              className="w-full sm:w-44"
              value={estate}
              options={[
                { id: ANY, label: t('leave.anyEstate') },
                ...(estates.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` })),
              ]}
              onChange={(next) => {
                setEstate(next ?? ANY);
              }}
            />
          </>
        }
        emptyState={
          <EmptyState kind="new" title={t('balances.emptyTitle')} description={t('balances.emptyBody')} />
        }
      />
      {adjusting ? (
        <AdjustDialog
          entitlement={adjusting}
          onClose={() => {
            setAdjusting(null);
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

export { LeaveBalancesPage as Component };
