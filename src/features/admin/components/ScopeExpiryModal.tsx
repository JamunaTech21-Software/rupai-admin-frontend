import { useState } from 'react';

import { todayIn } from '@/lib/dates';
import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { type BusinessDate } from '@/types';
import { Button, DatePicker, Modal, toast } from '@/ui';

import { type ScopeGrant, type User } from '../api/schemas';
import { useSetScopeExpiry } from '../api/scopes';
import { dhakaDate, endOfDhakaDay } from '../labels';
import { useScopeLabel } from './useScopeLabel';

export interface ScopeExpiryModalProps {
  readonly user: User;
  readonly grant: ScopeGrant;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}

/**
 * Set or clear a grant's expiry (PATCH with If-Match). A lapsed grant opens with no date, so saving straight
 * away makes it permanent again; a stale version opens the conflict dialog.
 */
export function ScopeExpiryModal({ user, grant, onClose, onRefused }: ScopeExpiryModalProps) {
  const { t } = useTranslation('admin');
  const label = useScopeLabel();
  const setExpiry = useSetScopeExpiry(user, grant);
  const [date, setDate] = useState<BusinessDate | null>(
    grant.expires_at && grant.active ? (dhakaDate(grant.expires_at) as BusinessDate) : null,
  );

  async function save() {
    try {
      await setExpiry.mutateAsync(date ? endOfDhakaDay(date) : null);
      toast.success(t('scope.expirySaved'));
      onClose();
    } catch (error) {
      onClose();
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('scope.expiryTitle', { scope: label(grant) })}
      description={t('scope.expiryHint')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('ui:cancel')}
          </Button>
          <Button
            isPending={setExpiry.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('user.save')}
          </Button>
        </>
      }
    >
      <DatePicker
        label={t('scope.expires')}
        hint={t('scope.expiresHint')}
        minValue={todayIn()}
        value={date}
        onChange={setDate}
      />
    </Modal>
  );
}
