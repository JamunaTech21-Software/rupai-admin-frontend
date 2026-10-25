import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, Button, ConfirmDialog, toast } from '@/ui';

import { useDeletePerson, useSetPersonStatus } from '../api/persons';
import { type Person, type PersonStatus } from '../api/schemas';

/** Active / Inactive. */
export function PersonStatusBadge({ status }: { readonly status: PersonStatus }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={status === 'active' ? 'success' : 'neutral'} label={t(`status.${status}`)} />;
}

/**
 * Deactivate / Reactivate and Delete for a person, each behind a confirmation. Deactivation keeps the record and its
 * history; delete only works for a person nothing refers to, and the server's REFERENCED_RECORD refusal says to
 * deactivate instead (shown by the page's RefusalDialog).
 */
export function PersonLifecycle({
  person,
  canEdit,
  canDelete,
  onDeleted,
  onRefused,
}: {
  readonly person: Person;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const setStatus = useSetPersonStatus(person);
  const remove = useDeletePerson(person);
  const [asking, setAsking] = useState<'status' | 'delete' | null>(null);
  const active = person.status === 'active';
  const name = person.full_name;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('status');
          }}
        >
          {t(active ? 'lifecycle.deactivate' : 'lifecycle.reactivate')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('lifecycle.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'status'}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={t(active ? 'lifecycle.deactivateTitle' : 'lifecycle.reactivateTitle', { name })}
        consequence={t(active ? 'lifecycle.deactivateBody' : 'lifecycle.reactivateBody')}
        confirmLabel={t(active ? 'lifecycle.deactivate' : 'lifecycle.reactivate')}
        onConfirm={async () => {
          try {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(t(active ? 'lifecycle.deactivated' : 'lifecycle.reactivated', { name }));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setAsking(null);
        }}
      />
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={t('lifecycle.deleteTitle', { name })}
        consequence={t('lifecycle.deleteBody')}
        confirmLabel={t('lifecycle.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('lifecycle.deleted', { name }));
            onDeleted();
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setAsking(null);
        }}
      />
    </div>
  );
}
