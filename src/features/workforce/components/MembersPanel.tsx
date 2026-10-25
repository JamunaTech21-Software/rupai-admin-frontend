import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  DatePicker,
  EmptyState,
  IconButton,
  Link,
  Modal,
  Select,
  toast,
} from '@/ui';

import {
  type Member,
  TEAM_ROLES,
  type Team,
  useChangeRole,
  useEndMember,
  useRemoveMember,
  useTeamHistory,
  useTeamMembers,
} from '../api/teams';
import { AddMembersModal } from './AddMembersModal';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Ask for a worker's last day in the team, then end the membership. */
function EndDialog({
  team,
  member,
  onClose,
  onRefused,
}: {
  readonly team: Team;
  readonly member: Member;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const end = useEndMember(team.id, member.profile.full_name);
  const [last, setLast] = useState<string | null>(todayIso());
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (last === null) {
      setError(t('members.pickDate'));
      return;
    }
    if (last < member.effective_from) {
      setError(t('members.beforeStart'));
      return;
    }
    try {
      await end.mutateAsync({ member, effective_to: last });
      toast.success(t('members.ended', { name: member.profile.full_name }));
      onClose();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      onClose();
    }
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('members.endTitle', { name: member.profile.full_name })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={end.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('members.end')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <DatePicker
          label={t('members.lastDay')}
          isRequired
          value={last}
          onChange={setLast}
          {...(error ? { error } : {})}
        />
        <p className="text-sm text-fg-muted">{t('members.endHint')}</p>
      </div>
    </Modal>
  );
}

/** Role change and the "entered in error" removal of one membership. */
function RowControls({
  team,
  member,
  canEdit,
  canDelete,
  onEnd,
  onRefused,
}: {
  readonly team: Team;
  readonly member: Member;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onEnd: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const change = useChangeRole(team.id, member.profile.full_name);
  const remove = useRemoveMember(team.id);
  const [confirming, setConfirming] = useState(false);
  const name = member.profile.full_name;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {canEdit && member.is_current ? (
        <>
          <Select
            label={t('members.roleOf', { name })}
            hideLabel
            className="w-32"
            value={member.role_in_team}
            isDisabled={change.isPending}
            options={TEAM_ROLES.map((value) => ({ id: value, label: t(`teamRoles.${value}`) }))}
            onChange={(next) => {
              const role = TEAM_ROLES.find((value) => value === next);
              if (!role || role === member.role_in_team) return;
              void change.mutateAsync({ member, role }).catch((error: unknown) => {
                if (errorBehaviour(error) !== 'conflict') onRefused(error);
              });
            }}
          />
          <Button size="sm" variant="secondary" onPress={onEnd}>
            {t('members.end')}
            <span className="sr-only"> {name}</span>
          </Button>
        </>
      ) : null}
      {canDelete ? (
        <>
          <IconButton
            icon="trash"
            variant="ghost"
            size="sm"
            label={t('members.remove', { name })}
            onPress={() => {
              setConfirming(true);
            }}
          />
          <ConfirmDialog
            isOpen={confirming}
            onOpenChange={setConfirming}
            title={t('members.removeTitle', { name })}
            consequence={t('members.removeBody')}
            confirmLabel={t('members.removeConfirm')}
            tone="danger"
            onConfirm={async () => {
              try {
                await remove.mutateAsync(member);
                toast.success(t('members.removed', { name }));
              } catch (error) {
                onRefused(error);
              }
              setConfirming(false);
            }}
          />
        </>
      ) : null}
    </span>
  );
}

/**
 * A team's members (team.view) on a chosen date, with the way to add workers, end a membership and change a role
 * (team.edit), and the History tab of every membership, past and future.
 */
export function MembersPanel({
  team,
  onRefused,
}: {
  readonly team: Team;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canEdit = usePermission('team.edit') && team.status === 'active';
  const canDelete = usePermission('team.delete');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<Member | null>(null);
  const members = useTeamMembers(team.id, asOf);
  const past = useTeamHistory(team.id);
  const list = history ? past : members;
  const rows = list.data ?? [];
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Member>[] = [
    {
      id: 'worker',
      header: t('members.columns.worker'),
      cell: (m) => <span className="font-medium">{m.profile.full_name}</span>,
    },
    {
      id: 'number',
      header: t('members.columns.number'),
      cell: (m) => (
        <Link href={`/workforce/profiles/${m.employment_profile_id}`} className="font-mono">
          {m.profile.profile_number}
        </Link>
      ),
    },
    { id: 'role', header: t('members.columns.role'), cell: (m) => t(`teamRoles.${m.role_in_team}`) },
    { id: 'from', header: t('members.columns.from'), cell: (m) => format.date(m.effective_from) },
    {
      id: 'to',
      header: t('members.columns.to'),
      cell: (m) => (m.effective_to ? format.date(m.effective_to) : none),
    },
    ...(history
      ? [
          {
            id: 'state',
            header: t('members.columns.state'),
            cell: (m: Member) => (
              <Badge
                tone={m.is_current ? 'success' : 'neutral'}
                label={t(m.is_current ? 'members.now' : 'members.past')}
              />
            ),
          } satisfies DataColumn<Member>,
        ]
      : [
          {
            id: 'actions',
            header: t('members.columns.actions'),
            cell: (m: Member) => (
              <RowControls
                team={team}
                member={m}
                canEdit={canEdit}
                canDelete={canDelete}
                onEnd={() => {
                  setEnding(m);
                }}
                onRefused={onRefused}
              />
            ),
          } satisfies DataColumn<Member>,
        ]),
  ];

  return (
    <>
      <Card
        title={history ? t('members.historyTitle') : t('members.title')}
        headingLevel={2}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setHistory((open) => !open);
              }}
            >
              {t(history ? 'members.showMembers' : 'members.showHistory')}
            </Button>
            {canEdit ? (
              <Button
                size="sm"
                iconStart="plus"
                onPress={() => {
                  setAdding(true);
                }}
              >
                {t('members.add')}
              </Button>
            ) : null}
          </span>
        }
      >
        {history ? null : (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <DatePicker label={t('members.asOf')} value={asOf ?? todayIso()} onChange={setAsOf} />
            {asOf ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setAsOf(null);
                }}
              >
                {t('members.today')}
              </Button>
            ) : null}
          </div>
        )}
        <DataTable
          label={history ? t('members.historyTitle') : t('members.title')}
          columns={columns}
          rows={rows}
          getRowId={(m) => m.id}
          getRowLabel={(m) => m.profile.full_name}
          isLoading={list.isPending}
          error={list.isError ? { message: t('members.failed'), onRetry: () => void list.refetch() } : null}
          isPlain
          emptyState={
            <EmptyState
              kind="new"
              title={t(history ? 'members.noHistoryTitle' : 'members.emptyTitle')}
              description={t(history ? 'members.noHistoryBody' : 'members.emptyBody')}
            />
          }
        />
      </Card>
      {adding ? (
        <AddMembersModal
          team={team}
          current={members.data ?? []}
          onClose={() => {
            setAdding(false);
          }}
          onRefused={onRefused}
        />
      ) : null}
      {ending ? (
        <EndDialog
          team={team}
          member={ending}
          onClose={() => {
            setEnding(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </>
  );
}
