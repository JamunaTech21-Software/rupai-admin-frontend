import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert } from '@/ui';

import { type BalanceProblem } from '../api/leave';

/** Why a request was refused: what is left, what is already asked for, and what was asked now. */
export function BalanceAlert({ problem }: { readonly problem: BalanceProblem }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  return (
    <Alert tone="danger" title={t('leave.insufficientTitle')}>
      {t('leave.insufficientBody', {
        available: format.decimal(problem.available_days, 1),
        balance: format.decimal(problem.balance_days, 1),
        pending: format.decimal(problem.pending_days, 1),
        requested: format.decimal(problem.requested_days, 1),
      })}
    </Alert>
  );
}
