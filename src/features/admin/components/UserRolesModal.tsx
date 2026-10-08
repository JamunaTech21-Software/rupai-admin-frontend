import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { type BusinessDate } from '@/types';
import { Button, Checkbox, DatePicker, Modal, Skeleton, toast } from '@/ui';

import {
  authorisationErrors,
  authorisationsRequired,
  type GivenAuthorisation,
  type NeededAuthorisation,
  useCheckRoles,
} from '../api/access';
import { useAllRoles } from '../api/roles';
import { type User } from '../api/schemas';
import { useAssignRoles } from '../api/users';
import { dhakaDate, endOfDhakaDay } from '../labels';

import { AuthorisationDialog } from './AuthorisationDialog';

export interface UserRolesModalProps {
  readonly user: User;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}

type Choice = Map<string, BusinessDate | null>;

function initialChoice(user: User): Choice {
  return new Map(
    user.roles.map((role) => [
      role.id,
      role.expires_at ? (dhakaDate(role.expires_at) as BusinessDate) : null,
    ]),
  );
}

/**
 * Choose a user's roles. The API replaces the whole set (POST /users/{id}/roles with If-Match), so the modal
 * edits the full list: tick to keep, untick to remove, an optional expiry per role.
 */
export function UserRolesModal({ user, isOpen, onClose, onRefused }: UserRolesModalProps) {
  const { t } = useTranslation('admin');
  const roles = useAllRoles();
  const assign = useAssignRoles(user);
  const checkRoles = useCheckRoles(user);
  const [choice, setChoice] = useState<Choice>(() => initialChoice(user));
  /** Set while the separation-of-duties dialog asks for authorisations. */
  const [needed, setNeeded] = useState<NeededAuthorisation[] | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({});

  // Active roles, plus any inactive role the user still holds (so it can be removed).
  const offered = (roles.data ?? []).filter((role) => role.status === 'active' || choice.has(role.id));

  function toggle(roleId: string, on: boolean) {
    const next = new Map(choice);
    if (on) next.set(roleId, null);
    else next.delete(roleId);
    setChoice(next);
  }

  const grants = () =>
    [...choice.entries()].map(([role_id, date]) => ({
      role_id,
      expires_at: date ? endOfDhakaDay(date) : null,
    }));

  /** Saves the roles; a conflict or sensitive permission without an authorisation opens the dialog instead. */
  async function commit(authorisations: GivenAuthorisation[] = []) {
    try {
      await assign.mutateAsync({
        roles: grants(),
        authorisations: authorisations.map(({ key, reason }) => ({ key, reason })),
      });
      toast.success(t('user.rolesSaved'));
      setNeeded(null);
      onClose();
    } catch (error) {
      const required = authorisationsRequired(error);
      if (required) {
        // Something changed since the preview (or it was skipped): ask for exactly what the server listed.
        setServerErrors({});
        setNeeded(required);
        return;
      }
      const reasonErrors = authorisationErrors(error);
      if (reasonErrors && needed) {
        setServerErrors(reasonErrors);
        return;
      }
      setNeeded(null);
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      onRefused(error);
    }
  }

  /** Preview first (POST /roles/check): when nothing needs authorising, save straight away. */
  async function save() {
    try {
      const check = await checkRoles.mutateAsync(grants());
      const missing = check.requirements
        .filter((requirement) => !requirement.authorised)
        .map((requirement): NeededAuthorisation => ({
          key: requirement.key,
          kind: requirement.kind,
          rule: requirement.rule,
          title: requirement.title,
          why: requirement.why,
          permissions: requirement.permissions,
          userId: null,
          username: null,
        }));
      if (missing.length > 0) {
        setServerErrors({});
        setNeeded(missing);
        return;
      }
    } catch (error) {
      onRefused(error);
      return;
    }
    await commit();
  }

  if (needed) {
    return (
      <AuthorisationDialog
        // A new list (from the server) starts with empty reason boxes.
        key={needed.map((item) => item.key).join('|')}
        isOpen={isOpen}
        needed={needed}
        intro={t('sod.rolesIntro', { username: user.username })}
        isPending={assign.isPending}
        serverErrors={serverErrors}
        onCancel={() => {
          setNeeded(null);
        }}
        onConfirm={(given) => {
          void commit(given);
        }}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={t('user.rolesTitle', { username: user.username })}
      description={t('user.rolesHint')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('ui:cancel')}
          </Button>
          <Button
            isPending={assign.isPending || checkRoles.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('user.save')}
          </Button>
        </>
      }
    >
      {roles.isPending ? (
        <Skeleton variant="text" lines={5} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {offered.map((role) => {
            const held = choice.has(role.id);
            return (
              <li
                key={role.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Checkbox
                  isSelected={held}
                  onChange={(on) => {
                    toggle(role.id, on);
                  }}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{role.name}</span>
                    <span className="text-sm text-fg-muted">
                      {role.code}
                      {role.status === 'inactive' ? ` · ${t('user.inactiveRole')}` : ''}
                    </span>
                  </span>
                </Checkbox>
                {held ? (
                  <DatePicker
                    label={t('user.expires')}
                    hint={t('user.noExpiry')}
                    className="ps-7 sm:w-56 sm:ps-0"
                    value={choice.get(role.id) ?? null}
                    onChange={(date) => {
                      setChoice(new Map(choice).set(role.id, date));
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
