import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, cx } from '@/ui';

import { type ApprovalStep, type StepStatus } from '../api/approvals';

const TONE: Record<StepStatus, BadgeTone> = {
  done: 'success',
  current: 'info',
  upcoming: 'draft',
  skipped: 'draft',
  not_reached: 'draft',
};

/**
 * The frozen path of an approval, step by step (P7 §3): what each step is, whether it applies to this document,
 * who decided it, and who may act on the current one. A step with nobody to act says so: the engine never skips it.
 */
export function ApprovalPath({
  steps,
  label,
}: {
  readonly steps: readonly ApprovalStep[];
  readonly label: string;
}) {
  const { t } = useTranslation('approvals');
  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {steps.map((step) => {
        const who = step.role?.name ?? step.user?.username ?? '';
        return (
          <li
            key={step.step_number}
            className={cx(
              'flex flex-col gap-1 rounded-md border px-4 py-3',
              step.status === 'current' ? 'border-primary bg-primary-subtle' : 'border-line bg-surface',
            )}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">
                {t('detail.step', { number: step.step_number })}
                {step.name ? ` · ${step.name}` : ''}
              </span>
              <Badge tone={TONE[step.status]} label={t(`stepStatus.${step.status}`)} />
            </div>
            {who ? <p className="text-sm text-fg-muted">{t('detail.approverIs', { who })}</p> : null}
            {step.status === 'done' && step.decided_by ? (
              <p className="text-sm text-fg-muted">
                {t('detail.decidedBy', { name: step.decided_by.username })}
              </p>
            ) : null}
            {step.status === 'current' ? (
              <p className="text-sm text-fg-muted">
                {step.approvers.length > 0
                  ? t('detail.canAct', { names: step.approvers.map((user) => user.username).join(', ') })
                  : t('detail.nobody')}
              </p>
            ) : null}
            {step.status === 'skipped' || !step.on_path ? (
              <p className="text-sm text-fg-muted">{t('detail.notNeeded')}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
