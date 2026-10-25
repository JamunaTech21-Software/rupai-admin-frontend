import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, EmptyState, Link, Skeleton } from '@/ui';

import { useProfileTeams } from '../api/teams';

/** A worker's profile, Teams tab (team.view): every team they have been in, newest first, and where they are now. */
export function TeamsOfWorker({ profileId }: { readonly profileId: string }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canView = usePermission('team.view');
  const teams = useProfileTeams(profileId);
  const rows = teams.data ?? [];

  if (!canView) return <p className="text-sm text-fg-muted">{t('members.noAccess')}</p>;

  return (
    <Card title={t('members.workerTeams')} headingLevel={2}>
      {teams.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={2} />
      ) : teams.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void teams.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          kind="new"
          title={t('members.workerEmptyTitle')}
          description={t('members.workerEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex flex-col">
                <Link href={`/workforce/teams/${row.worker_team_id}`}>{row.team.name}</Link>
                <span className="text-fg-muted">{t(`teamRoles.${row.role_in_team}`)}</span>
              </span>
              <span className="text-fg-muted">
                {format.date(row.effective_from)} –{' '}
                {row.effective_to ? format.date(row.effective_to) : t('assignments.present')}
              </span>
              <Badge
                tone={row.is_current ? 'success' : 'neutral'}
                label={t(row.is_current ? 'members.now' : 'members.past')}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
