import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { ConfirmDialog, IconButton, toast } from '@/ui';

import { type Setting, useDeleteSetting } from '../api/settings';

/** Edit and Delete for one setting. Code that reads a deleted key falls back to its own default. */
export function SettingActions({
  setting,
  canEdit,
  canDelete,
  onEdit,
  onRefused,
}: {
  readonly setting: Setting;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('config');
  const remove = useDeleteSetting(setting);
  const [confirming, setConfirming] = useState(false);

  return (
    <span className="flex shrink-0 items-center gap-1">
      {canEdit ? (
        <IconButton
          icon="edit"
          variant="ghost"
          size="sm"
          label={t('settings.edit', { key: setting.key })}
          onPress={onEdit}
        />
      ) : null}
      {canDelete ? (
        <IconButton
          icon="trash"
          variant="ghost"
          size="sm"
          label={t('settings.delete', { key: setting.key })}
          onPress={() => {
            setConfirming(true);
          }}
        />
      ) : null}
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t('settings.deleteTitle', { key: setting.key })}
        consequence={t('settings.deleteBody')}
        confirmLabel={t('settings.deleteButton')}
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('settings.deleted', { key: setting.key }));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setConfirming(false);
        }}
      />
    </span>
  );
}
