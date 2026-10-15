import { useTranslation } from '@/lib/i18n';
import { Timeline, type TimelineEvent } from '@/ui';

import { type ApprovalAction } from '../api/approvals';

const STATE = { approve: 'approved', reject: 'rejected' } as const;

/** What was done on an approval, oldest first: who, for whom if under a delegation, when, and what they wrote. */
export function ApprovalHistory({ actions }: { readonly actions: readonly ApprovalAction[] }) {
  const { t } = useTranslation('approvals');
  const events: TimelineEvent[] = actions.map((action) => ({
    id: action.id,
    title: t(`history.${action.action}`, { step: action.step_number ?? 0 }),
    ...(action.action === 'approve' || action.action === 'reject' ? { state: STATE[action.action] } : {}),
    actor: action.acting_for
      ? t('history.onBehalf', { name: action.user.username, for: action.acting_for.username })
      : action.user.username,
    at: action.acted_at,
    ...(action.comment || action.is_self_approval
      ? {
          note: (
            <>
              {action.comment ? <span className="block">{action.comment}</span> : null}
              {action.is_self_approval ? (
                <span className="block text-fg-muted">{t('history.selfApproval')}</span>
              ) : null}
            </>
          ),
        }
      : {}),
  }));
  return <Timeline events={events} label={t('detail.history')} />;
}
