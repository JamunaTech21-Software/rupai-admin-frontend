import { useState } from 'react';

import { describeError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Alert, Badge, Button, Card, Input, Select, Skeleton } from '@/ui';

import { type DocumentType, usePreview } from '../api/workflows';

const ANY = 'unset';

/**
 * Try a workflow on a sample document (P7 §15): fill in some of the fields of the document type and see which steps
 * would fire, in what order, and who could decide them. A reporting-line or cost-centre step is decided only when a
 * real document is submitted, so it says that. A step that fires with nobody to act is shown as a problem: it
 * would raise an approval exception.
 */
export function PreviewPanel({
  workflowId,
  documentType,
}: {
  readonly workflowId: string;
  readonly documentType: DocumentType | undefined;
}) {
  const { t } = useTranslation('workflows');
  const fields = documentType?.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [sample, setSample] = useState<Record<string, string> | null>(null);
  const preview = usePreview(workflowId, sample);

  const set = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  };
  const run = () => {
    setSample(Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== '')));
  };

  return (
    <Card title={t('preview.title')} description={t('preview.intro')} headingLevel={2}>
      <div className="flex flex-col gap-4">
        {fields.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) =>
              field.class === 'flag' ? (
                <Select
                  key={field.name}
                  label={field.label}
                  value={values[field.name] ?? ANY}
                  options={[
                    { id: ANY, label: t('preview.unset') },
                    { id: 'true', label: t('preview.yes') },
                    { id: 'false', label: t('preview.no') },
                  ]}
                  onChange={(value) => {
                    set(field.name, value === null || value === ANY ? '' : value);
                  }}
                />
              ) : (
                <Input
                  key={field.name}
                  label={field.label}
                  value={values[field.name] ?? ''}
                  {...(field.class === 'amount' || field.class === 'quantity'
                    ? { inputMode: 'decimal' as const }
                    : {})}
                  onChange={(value) => {
                    set(field.name, value);
                  }}
                />
              ),
            )}
          </div>
        ) : (
          <p className="text-fg-muted">{t('preview.noFields')}</p>
        )}
        <div>
          <Button isPending={preview.isFetching} onPress={run}>
            {t('preview.run')}
          </Button>
        </div>
        {preview.isPending && sample !== null ? <Skeleton variant="block" className="h-24 w-full" /> : null}
        {preview.isError ? (
          <Alert tone="danger" title={t('preview.failed')}>
            {describeError(preview.error).message}
          </Alert>
        ) : null}
        {preview.data ? (
          <div className="flex flex-col gap-3">
            {preview.data.applies ? null : (
              <Alert tone="info" title={t('preview.notApplicable')}>
                {t('preview.notApplicableBody')}
              </Alert>
            )}
            <ol aria-label={t('preview.result')} className="flex flex-col gap-2">
              {preview.data.steps.map((step) => (
                <li
                  key={step.step_number}
                  className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">
                      {t('detail.step', { number: step.step_number })}
                      {step.name ? ` · ${step.name}` : ''}
                    </span>
                    {step.fires ? (
                      <Badge
                        tone="info"
                        label={t('preview.fires', { position: step.path_position ?? step.step_number })}
                      />
                    ) : (
                      <Badge tone="draft" label={t('preview.skipped')} />
                    )}
                    {step.unresolved ? <Badge tone="danger" label={t('preview.unresolved')} /> : null}
                  </div>
                  {step.fires ? (
                    <p className="text-sm text-fg-muted">
                      {step.approvers_deferred
                        ? t('preview.deferred')
                        : step.approvers.length > 0
                          ? t('preview.approvers', {
                              names: step.approvers.map((user) => user.username).join(', '),
                            })
                          : t('preview.nobody')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
