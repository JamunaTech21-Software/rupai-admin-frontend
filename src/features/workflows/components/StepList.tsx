import { useTranslation } from '@/lib/i18n';
import { Alert, Badge } from '@/ui';

import { type DocumentType, type Workflow } from '../api/workflows';
import { ConditionText } from './ConditionText';

/**
 * The steps of a workflow in order: who approves each, when it applies, and the server's warnings for it (a role
 * nobody holds, an approver who can also create the document, an approver without the permission). Warnings do not
 * stop a workflow being saved; they say what to look at.
 */
export function StepList({
  workflow,
  documentType,
}: {
  readonly workflow: Workflow;
  readonly documentType: DocumentType | undefined;
}) {
  const { t } = useTranslation('workflows');
  return (
    <ol aria-label={t('detail.steps')} className="flex flex-col gap-3">
      {workflow.steps.map((step) => {
        const who =
          step.approver_rule === 'by_role'
            ? (step.role?.name ?? '')
            : step.approver_rule === 'by_named_user'
              ? (step.user?.username ?? '')
              : step.approver_rule === 'by_reporting_line'
                ? t('editor.levelOption', { level: step.reporting_level ?? 1 })
                : '';
        const warnings = (workflow.warnings ?? []).filter((w) => w.step_number === step.step_number);
        return (
          <li
            key={step.id}
            className="flex flex-col gap-2 rounded-md border border-line bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">
                {t('detail.step', { number: step.step_number })}
                {step.name ? ` · ${step.name}` : ''}
              </span>
              {step.allow_self_approval ? <Badge tone="warning" label={t('detail.selfAllowed')} /> : null}
            </div>
            <p className="text-sm text-fg-muted">
              {t(`rules.${step.approver_rule}`)}
              {who ? `: ${who}` : ''}
            </p>
            <p className="text-sm text-fg-muted">
              {step.condition ? (
                <>
                  {t('detail.appliesWhen')}{' '}
                  <ConditionText condition={step.condition} documentType={documentType} />
                </>
              ) : (
                t('detail.always')
              )}
            </p>
            {warnings.map((warning) => (
              <Alert key={warning.code} tone="warning" title={t('detail.warning')}>
                {warning.message}
              </Alert>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
