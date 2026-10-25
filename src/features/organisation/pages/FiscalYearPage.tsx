import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError, errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Stack,
  StatCard,
  toast,
} from '@/ui';

import {
  useDeleteFiscalYear,
  useFiscalYear,
  useGeneratePeriods,
  usePeriodsOfYear,
  useUpdateFiscalYear,
} from '../api/calendar';
import { type AccountingPeriod, type FiscalYear, NODE_CODE } from '../api/schemas';
import { fiscalYearTone } from '../calendarTones';
import { PeriodStateBadge } from '../components/CalendarBadges';
import { OpenPeriodButton } from '../components/OpenPeriodButton';

/** Calendars → Fiscal years → one fiscal year: its dates, code and name, and its 13 accounting periods. */
export function FiscalYearPage() {
  const { id = '' } = useParams();
  const query = useFiscalYear(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version: after a save or a conflict reload the form shows what is stored.
  return <FiscalYearView key={`${query.data.id}-${String(query.data.version)}`} year={query.data} />;
}

function FiscalYearView({ year }: { readonly year: FiscalYear }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const navigate = useNavigate();
  const canEdit = usePermission('fiscal_year.edit');
  const canDelete = usePermission('fiscal_year.delete');
  const update = useUpdateFiscalYear(year);
  const remove = useDeleteFiscalYear(year);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z.object({
    code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
    name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('fiscalYear.name').toLowerCase() }))
      .max(150),
  });
  const form = useZodForm(schema, { defaultValues: { code: year.code, name: year.name } });
  const bind = { code: useFormField(form.control, 'code'), name: useFormField(form.control, 'name') };

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ code: values.code.trim(), name: values.name.trim() });
      toast.success(t('fiscalYear.saved'));
      void navigate('/fiscal-years');
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  return (
    <Stack gap={6}>
      <PageHeader
        title={year.name}
        status={{ tone: fiscalYearTone(year.state), label: t(`fiscalYearState.${year.state}`) }}
        description={year.code}
        breadcrumbs={[{ label: t('fiscalYear.backToList'), href: '/fiscal-years' }, { label: year.name }]}
        actions={
          // Only a year nothing has been opened in can be deleted.
          canDelete && year.state === 'future' ? (
            <Button
              variant="danger"
              iconStart="trash"
              onPress={() => {
                setIsDeleting(true);
              }}
            >
              {t('actions.delete')}
            </Button>
          ) : undefined
        }
      />
      <YearSummary year={year} />
      {!canEdit ? <PermissionNotice /> : null}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Card title={t('fiscalYear.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('fiscalYear.code')}
              isRequired
              autoComplete="off"
              {...bind.code}
              isReadOnly={!canEdit}
            />
            <Input
              label={t('fiscalYear.name')}
              isRequired
              autoComplete="off"
              {...bind.name}
              isReadOnly={!canEdit}
            />
            <Input label={t('fiscalYear.startDate')} value={format.date(year.start_date)} isReadOnly />
            <Input
              label={t('fiscalYear.endDate')}
              hint={t('fiscalYear.datesFixed')}
              value={format.date(year.end_date)}
              isReadOnly
            />
          </div>
        </Card>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" isPending={update.isPending} className="w-full sm:w-auto">
              {t('actions.save')}
            </Button>
          </div>
        ) : null}
      </form>
      <YearPeriods year={year} onRefused={setRefusal} />
      <ConfirmDialog
        isOpen={isDeleting}
        onOpenChange={setIsDeleting}
        tone="danger"
        title={t('fiscalYear.deleteTitle', { name: year.name })}
        consequence={t('fiscalYear.deleteBody')}
        confirmLabel={t('actions.delete')}
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('fiscalYear.deleted', { name: year.name }));
            void navigate('/fiscal-years', { replace: true });
          } catch (error) {
            setIsDeleting(false);
            if (errorBehaviour(error) !== 'conflict') setRefusal(error);
          }
        }}
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

/** The fiscal year at a glance: its dates, how many periods it has and how many are open. */
function YearSummary({ year }: { readonly year: FiscalYear }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canViewPeriods = usePermission('accounting_period.view');
  const periods = usePeriodsOfYear(canViewPeriods && year.period_count > 0 ? year.id : '');
  const openCount = periods.data?.filter((p) => p.state === 'open' || p.state === 'reopened').length;

  return (
    <section aria-label={t('fiscalYear.summary')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('fiscalYear.startDate')} value={format.date(year.start_date)} />
        <StatCard label={t('fiscalYear.endDate')} value={format.date(year.end_date)} />
        <StatCard
          label={t('fiscalYear.periods')}
          value={year.period_count > 0 ? format.number(year.period_count) : t('fiscalYears.notGenerated')}
        />
        <StatCard
          label={t('fiscalYear.openPeriods')}
          value={
            year.period_count === 0 || !canViewPeriods
              ? format.number(0)
              : openCount === undefined
                ? '…'
                : format.number(openCount)
          }
        />
      </div>
    </section>
  );
}

/** The 13 periods, or "Generate periods" while the year has none. */
function YearPeriods({
  year,
  onRefused,
}: {
  readonly year: FiscalYear;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canGenerate = usePermission('fiscal_year.create');
  const canView = usePermission('accounting_period.view');
  const canOpen = usePermission('accounting_period.edit');
  const generate = useGeneratePeriods(year);
  const periods = usePeriodsOfYear(canView && year.period_count > 0 ? year.id : '');
  const rows = periods.data ?? [];
  // Periods open in order: "Open" is offered on the first future one only.
  const next = rows.find((p) => p.state === 'future');

  const columns: DataColumn<AccountingPeriod>[] = [
    {
      id: 'period_number',
      header: t('periods.columns.number'),
      isNumeric: true,
      align: 'center',
      cell: (period) => format.number(period.period_number),
    },
    {
      id: 'name',
      header: t('periods.columns.name'),
      cell: (period) => period.name,
    },
    {
      id: 'start_date',
      header: t('periods.columns.start'),
      align: 'center',
      cell: (period) => <span className="whitespace-nowrap">{format.date(period.start_date)}</span>,
    },
    {
      id: 'end_date',
      header: t('periods.columns.end'),
      align: 'center',
      cell: (period) => <span className="whitespace-nowrap">{format.date(period.end_date)}</span>,
    },
    {
      id: 'state',
      header: t('periods.columns.state'),
      align: 'center',
      cell: (period) => <PeriodStateBadge state={period.state} />,
    },
    ...(canOpen
      ? [
          {
            id: 'action',
            header: t('periods.columns.action'),
            align: 'center',
            cell: (period) =>
              period.id === next?.id ? <OpenPeriodButton period={period} onRefused={onRefused} /> : null,
          } satisfies DataColumn<AccountingPeriod>,
        ]
      : []),
  ];

  async function runGenerate() {
    try {
      const created = await generate.mutateAsync();
      toast.success(t('fiscalYear.generated', { count: created.length }));
    } catch (error) {
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  return (
    <Card title={t('fiscalYear.periods')} headingLevel={2}>
      {year.period_count === 0 ? (
        <EmptyState
          kind="new"
          title={t('fiscalYear.noPeriodsTitle')}
          description={t('fiscalYear.noPeriodsBody')}
          {...(canGenerate
            ? {
                action: (
                  <Button
                    isPending={generate.isPending}
                    onPress={() => {
                      void runGenerate();
                    }}
                  >
                    {t('fiscalYear.generate')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : !canView ? (
        <Alert tone="info">{t('fiscalYear.noPeriodsAccess')}</Alert>
      ) : (
        <Stack gap={4}>
          <p className="text-sm text-fg-muted">{t('fiscalYear.periodsIntro')}</p>
          <DataTable
            label={t('fiscalYear.periodsTitle')}
            columns={columns}
            rows={rows}
            getRowId={(period) => period.id}
            getRowLabel={(period) => period.name}
            isLoading={periods.isPending}
            error={
              periods.isError
                ? {
                    ...describeError(periods.error),
                    onRetry: () => void periods.refetch(),
                    isRetrying: periods.isFetching,
                  }
                : null
            }
          />
        </Stack>
      )}
    </Card>
  );
}

export { FiscalYearPage as Component };
