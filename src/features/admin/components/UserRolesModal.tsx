import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { type BusinessDate } from '@/types';
import { Button, Checkbox, DatePicker, Modal, Skeleton, toast } from '@/ui';

import { useAllRoles } from '../api/roles';
import { type User } from '../api/schemas';
import { useAssignRoles } from '../api/users';
import { dhakaDate, endOfDhakaDay } from '../labels';

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
  const [choice, setChoice] = useState<Choice>(() => initialChoice(user));

  // Active roles, plus any inactive role the user still holds (so it can be removed).
  const offered = (roles.data ?? []).filter((role) => role.status === 'active' || choice.has(role.id));

  function toggle(roleId: string, on: boolean) {
    const next = new Map(choice);
    if (on) next.set(roleId, null);
    else next.delete(roleId);
    setChoice(next);
  }

  async function save() {
    try {
      await assign.mutateAsync(
        [...choice.entries()].map(([role_id, date]) => ({
          role_id,
          expires_at: date ? endOfDhakaDay(date) : null,
        })),
      );
      toast.success(t('user.rolesSaved'));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      onRefused(error);
    }
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
            isPending={assign.isPending}
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
