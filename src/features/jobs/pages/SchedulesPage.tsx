import { useState } from 'react';
import { useNavigate } from 'react-router';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError, errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Badge,
  Button,
  Card,
  type DataColumn,
  DataTable,
  EmptyState,
  IconButton,
  Link,
  PageHeader,
  Stack,
  toast,
} from '@/ui';

import {
  type JobProcess,
  type Schedule,
  useProcesses,
  useRunSchedule,
  useSchedules,
  useStartTestJob,
  useToggleSchedule,
} from '../api/jobs';
import { JobStateBadge } from '../components/JobStateBadge';

/** What a failed list shows in a table: the message and its reference, with a retry. */
function listError(error: unknown, retry: () => void) {
  if (!error) return null;
  const { message, requestId } = describeError(error);
  return { message, requestId, onRetry: retry };
}

/** Pause, resume and run now for one recurring task (system.edit). */
function ScheduleActions({
  schedule,
  onRefused,
}: {
  readonly schedule: Schedule;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('jobs');
  const navigate = useNavigate();
  const toggle = useToggleSchedule(schedule);
  const run = useRunSchedule(schedule);
  const name = schedule.job_label;

  async function guard(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  return (
    <span className="flex items-center gap-1">
      <IconButton
        icon={schedule.is_paused ? 'refresh' : 'ban'}
        variant="ghost"
        size="sm"
        label={t(schedule.is_paused ? 'schedules.resume' : 'schedules.pause', { name })}
        onPress={() => {
          void guard(async () => {
            await toggle.mutateAsync(schedule.is_paused ? 'resume' : 'pause');
            toast.success(
              t(schedule.is_paused ? 'schedules.resumedToast' : 'schedules.pausedToast', { name }),
            );
          });
        }}
      />
      <IconButton
        icon="send"
        variant="ghost"
        size="sm"
        label={t('schedules.run', { name })}
        onPress={() => {
          void guard(async () => {
            const job = await run.mutateAsync();
            toast.success(t('schedules.startedToast', { name }));
            void navigate(`/jobs/${job.id}`);
          });
        }}
      />
    </span>
  );
}

/**
 * Admin → Recurring jobs (P1.15): the tasks the system starts on a timetable (with pause, resume and run now for
 * system.edit) and the worker and scheduler processes that run them. Those with system.edit can also start a test
 * job, to watch the job system work or to see a job fail and retry it.
 */
export function SchedulesPage() {
  const { t } = useTranslation('jobs');
  const format = useFormat();
  const navigate = useNavigate();
  const canEdit = usePermission('system.edit');
  const schedules = useSchedules();
  const processes = useProcesses();
  const startTest = useStartTestJob();
  const [refusal, setRefusal] = useState<unknown>(null);

  const when = (value: string | null) =>
    value ? format.dateTime(value) : <span className="text-fg-muted">{t('schedules.neverRun')}</span>;

  const scheduleColumns: DataColumn<Schedule>[] = [
    {
      id: 'task',
      header: t('schedules.columns.task'),
      cell: (schedule) => (
        <span className="flex flex-col">
          <span className="font-medium">{schedule.job_label}</span>
          <span className="text-sm text-fg-muted">{schedule.description}</span>
        </span>
      ),
    },
    {
      id: 'timetable',
      header: t('schedules.columns.timetable'),
      cell: (schedule) => (
        <span className="text-sm">
          {t('schedules.timetable', { cron: schedule.cron, timezone: schedule.timezone })}
        </span>
      ),
    },
    {
      id: 'next',
      header: t('schedules.columns.nextRun'),
      cell: (schedule) => (schedule.is_paused ? '' : when(schedule.next_run_at)),
    },
    {
      id: 'last',
      header: t('schedules.columns.lastRun'),
      cell: (schedule) => (
        <span className="flex flex-col items-start gap-1">
          {when(schedule.last_run_at)}
          {schedule.last_job ? (
            <span className="flex items-center gap-2">
              <JobStateBadge
                job={{
                  state: schedule.last_job.state as Parameters<typeof JobStateBadge>[0]['job']['state'],
                  attempts: 0,
                }}
              />
              <Link href={`/jobs/${schedule.last_job.id}`}>{t('open', { label: schedule.job_label })}</Link>
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('schedules.columns.status'),
      cell: (schedule) =>
        schedule.is_paused ? (
          <Badge tone="warning" label={t('schedules.paused')} />
        ) : (
          <Badge tone="success" label={t('schedules.active')} />
        ),
    },
    ...(canEdit
      ? [
          {
            id: 'actions',
            header: t('schedules.columns.actions'),
            align: 'center',
            cell: (schedule) => <ScheduleActions schedule={schedule} onRefused={setRefusal} />,
          } satisfies DataColumn<Schedule>,
        ]
      : []),
  ];

  const processColumns: DataColumn<JobProcess>[] = [
    {
      id: 'process',
      header: t('schedules.processColumns.process'),
      cell: (process) => <span className="font-medium">{t(`schedules.kinds.${process.kind}`)}</span>,
    },
    {
      id: 'host',
      header: t('schedules.processColumns.host'),
      cell: (process) => `${process.host} (${String(process.pid)})`,
    },
    {
      id: 'version',
      header: t('schedules.processColumns.version'),
      canHide: true,
      cell: (process) => process.app_version,
    },
    {
      id: 'beat',
      header: t('schedules.processColumns.lastBeat'),
      cell: (process) => format.dateTime(process.last_beat_at),
    },
    {
      id: 'state',
      header: t('schedules.processColumns.state'),
      cell: (process) =>
        process.is_alive ? (
          <Badge tone="success" label={t('schedules.alive')} />
        ) : (
          <Badge tone="danger" label={t('schedules.notResponding')} />
        ),
    },
  ];

  async function start(failAttempts: number) {
    try {
      const job = await startTest.mutateAsync({ steps: 20, stepMs: 1000, failAttempts });
      toast.success(t('schedules.testStarted'));
      void navigate(`/jobs/${job.id}`);
    } catch (error) {
      if (errorBehaviour(error) !== 'conflict') setRefusal(error);
    }
  }

  return (
    <Stack gap={6}>
      <PageHeader title={t('schedules.title')} description={t('schedules.description')} />
      <Card title={t('schedules.tasks')} headingLevel={2} padding="none">
        <DataTable
          isPlain
          label={t('schedules.title')}
          columns={scheduleColumns}
          rows={schedules.data ?? []}
          getRowId={(schedule) => schedule.name}
          getRowLabel={(schedule) => schedule.job_label}
          isLoading={schedules.isPending}
          error={listError(schedules.error, () => void schedules.refetch())}
          emptyState={
            <EmptyState kind="new" title={t('schedules.emptyTitle')} description={t('schedules.emptyBody')} />
          }
        />
      </Card>
      <Card
        title={t('schedules.runners')}
        description={t('schedules.processesIntro')}
        headingLevel={2}
        padding="none"
      >
        <DataTable
          isPlain
          label={t('schedules.processes')}
          columns={processColumns}
          rows={processes.data ?? []}
          getRowId={(process) => process.key}
          getRowLabel={(process) => t(`schedules.kinds.${process.kind}`)}
          isLoading={processes.isPending}
          error={listError(processes.error, () => void processes.refetch())}
          emptyState={<EmptyState kind="new" title={t('schedules.noProcesses')} />}
        />
      </Card>
      {canEdit ? (
        <Card title={t('schedules.test')} description={t('schedules.testIntro')} headingLevel={2}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              isPending={startTest.isPending}
              onPress={() => {
                void start(0);
              }}
            >
              {t('schedules.startTest')}
            </Button>
            <Button
              variant="secondary"
              isPending={startTest.isPending}
              onPress={() => {
                void start(5);
              }}
            >
              {t('schedules.startFailing')}
            </Button>
          </div>
        </Card>
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

export { SchedulesPage as Component };
