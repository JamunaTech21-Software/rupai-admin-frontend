import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, Button, DatePicker, Modal, MultiSelect, Select, toast } from '@/ui';

import { useEstateWorkers } from '../api/profiles';
import { type Member, type NewMember, TEAM_ROLES, type Team, useAddMembers } from '../api/teams';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Add workers to a team from a date, with a role (workers of the team's estate who are not already in it). All are
 * added or none. A worker still in another team is named, and can be moved: their other membership then ends the
 * day before.
 */
export function AddMembersModal({
  team,
  current,
  onClose,
  onRefused,
}: {
  readonly team: Team;
  /** The members today, who are not offered again. */
  readonly current: readonly Member[];
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const workers = useEstateWorkers(team.estate_id);
  const add = useAddMembers(team.id);
  const [picked, setPicked] = useState<string[]>([]);
  const [from, setFrom] = useState<string | null>(todayIso());
  const [role, setRole] = useState<(typeof TEAM_ROLES)[number]>('member');
  const [error, setError] = useState<string | null>(null);
  /** Workers refused for being in another team: shown with the way to move them. */
  const [elsewhere, setElsewhere] = useState<readonly string[]>([]);
  const inTeam = new Set(current.map((member) => member.employment_profile_id));
  const options = (workers.data ?? [])
    .filter((profile) => !inTeam.has(profile.id))
    .map((profile) => ({ id: profile.id, label: `${profile.person.full_name} (${profile.profile_number})` }));

  const send = async (move: boolean) => {
    if (picked.length === 0) {
      setError(t('members.pickWorkers'));
      return;
    }
    if (from === null) {
      setError(t('members.pickDate'));
      return;
    }
    setError(null);
    const members: NewMember[] = picked.map((id) => ({
      employment_profile_id: id,
      effective_from: from,
      role_in_team: role,
    }));
    try {
      await add.mutateAsync({ members, move });
      toast.success(t('members.added', { count: members.length }));
      onClose();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      if (isApiError(failure) && failure.code === 'DUPLICATE_KEY') {
        const named = failure.details
          .filter((d) => d.context?.worker_team_id !== undefined)
          .map((d) => d.message);
        if (named.length > 0) {
          setElsewhere(named);
          return;
        }
      }
      if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
        setError(failure.details[0]?.message ?? failure.message);
        return;
      }
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
      title={t('members.addTitle', { name: team.name })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={add.isPending}
            onPress={() => {
              void send(false);
            }}
          >
            {t('members.add')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <MultiSelect
          label={t('members.workers')}
          placeholder={t('form.select')}
          isRequired
          value={picked}
          options={options}
          onChange={(next) => {
            setPicked(next);
            setElsewhere([]);
          }}
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <DatePicker label={t('members.from')} isRequired value={from} onChange={setFrom} />
          <Select
            label={t('members.role')}
            value={role}
            options={TEAM_ROLES.map((value) => ({ id: value, label: t(`teamRoles.${value}`) }))}
            onChange={(next) => {
              setRole(TEAM_ROLES.find((value) => value === next) ?? 'member');
            }}
          />
        </div>
        <p className="text-sm text-fg-muted">
          {t('members.fromHint', { date: from ? format.date(from) : '' })}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {elsewhere.length > 0 ? (
          <Alert tone="warning" title={t('members.elsewhereTitle')}>
            <ul className="list-disc ps-5">
              {elsewhere.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3">
              <Button
                size="sm"
                isPending={add.isPending}
                onPress={() => {
                  void send(true);
                }}
              >
                {t('members.move')}
              </Button>
            </div>
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
