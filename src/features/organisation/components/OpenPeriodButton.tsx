import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Button, ConfirmDialog, toast } from '@/ui';

import { useOpenPeriod } from '../api/calendar';
import { type AccountingPeriod } from '../api/schemas';

/**
 * "Open" on a future accounting period, behind a confirmation. Periods open in order: the server refuses an
 * out-of-order open with "Open period N (name) first.", shown in the page's refusal dialog.
 */
export function OpenPeriodButton({
  period,
  onRefused,
}: {
  readonly period: AccountingPeriod;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const open = useOpenPeriod(period);
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        aria-label={t('periods.openLabel', { name: period.name })}
        onPress={() => {
          setIsConfirming(true);
        }}
      >
        {t('periods.open')}
      </Button>
      <ConfirmDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title={t('periods.openTitle', { name: period.name })}
        consequence={t('periods.openBody')}
        confirmLabel={t('periods.open')}
        onConfirm={async () => {
          try {
            await open.mutateAsync();
            toast.success(t('periods.opened', { name: period.name }));
          } catch (error) {
            setIsConfirming(false);
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
        }}
      />
    </>
  );
}
