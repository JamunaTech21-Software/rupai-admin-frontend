import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, EmptyState, Link, Skeleton } from '@/ui';

import { useProfileTrainings } from '../api/training';

/** A profile's page, Training tab (training.view): every programme they took part in, latest first, with the result. */
export function ProfileTrainings({ profileId }: { readonly profileId: string }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canView = usePermission('training.view');
  const list = useProfileTrainings(profileId);
  const rows = list.data ?? [];

  if (!canView) return <p className="text-sm text-fg-muted">{t('members.noAccess')}</p>;

  return (
    <Card title={t('training.history')} headingLevel={2}>
      {list.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={2} />
      ) : list.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          kind="new"
          title={t('training.historyEmptyTitle')}
          description={t('training.historyEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex flex-col">
                <Link href={`/hr/training/${row.training_program_id}`}>{row.program.title}</Link>
                <span className="text-fg-muted">
                  {format.date(row.program.start_date)}
                  {row.certificate_number ? ` · ${t('training.certificate')}: ${row.certificate_number}` : ''}
                </span>
              </span>
              <span className="text-fg-muted">
                {t(`trainingResults.${row.result}`)}
                {row.score ? ` · ${format.decimal(row.score, 1)}` : ''}
              </span>
              <Badge
                tone={row.attendance_status === 'attended' ? 'success' : 'neutral'}
                label={t(`attendance.${row.attendance_status}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
