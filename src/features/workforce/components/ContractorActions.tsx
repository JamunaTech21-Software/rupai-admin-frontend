import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, Modal, Textarea, toast } from '@/ui';

import { type Contractor, useBlacklist } from '../api/contractors';

const TONES: Record<Contractor['status'], BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  blacklisted: 'danger',
};

/** Active / Inactive / Blacklisted. */
export function ContractorStatusBadge({ status }: { readonly status: Contractor['status'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[status]} label={t(`contractorStatus.${status}`)} />;
}

/**
 * Blacklist a contractor (contractor.approve) with the reason. A blacklisted contractor can be looked at but not
 * changed or given new contracts.
 */
export function ContractorActions({
  contractor,
  canApprove,
  onRefused,
}: {
  readonly contractor: Contractor;
  readonly canApprove: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const blacklist = useBlacklist(contractor);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!canApprove || contractor.status === 'blacklisted') return null;

  const close = () => {
    setAsking(false);
    setReason('');
    setError(null);
  };
  const submit = async () => {
    if (reason.trim().length < 3) {
      setError(t('validation.reason'));
      return;
    }
    try {
      await blacklist.mutateAsync(reason.trim());
      toast.success(t('contractor.blacklisted', { name: contractor.name }));
      close();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      close();
    }
  };

  return (
    <>
      <Button
        variant="danger"
        onPress={() => {
          setAsking(true);
        }}
      >
        {t('contractor.blacklist')}
      </Button>
      {asking ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={t('contractor.blacklistTitle', { name: contractor.name })}
          footer={
            <>
              <Button variant="secondary" onPress={close}>
                {t('actions.cancel')}
              </Button>
              <Button
                variant="danger"
                isPending={blacklist.isPending}
                onPress={() => {
                  void submit();
                }}
              >
                {t('contractor.blacklist')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg-muted">{t('contractor.blacklistWarning')}</p>
            <Textarea
              label={t('actions.reason')}
              placeholder={t('actions.reasonPlaceholder')}
              rows={3}
              maxLength={500}
              isRequired
              value={reason}
              onChange={setReason}
              {...(error ? { error } : {})}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
