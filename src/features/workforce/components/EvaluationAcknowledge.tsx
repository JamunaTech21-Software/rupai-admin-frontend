import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, Card, Textarea, toast } from '@/ui';

import { type Evaluation, useAcknowledge } from '../api/performance';

/**
 * The evaluated employee's answer (Spec P2.10): once an evaluation is approved they read it and acknowledge it,
 * with a comment if they wish, and it is locked. Only they may; anyone else who tries is refused by the backend and
 * told why. After that it is read-only here, and shows what the employee wrote.
 */
export function EvaluationAcknowledge({
  evaluation,
  onRefused,
}: {
  readonly evaluation: Evaluation;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const acknowledge = useAcknowledge(evaluation.evaluation_number);
  const [comment, setComment] = useState('');

  if (evaluation.state === 'acknowledged') {
    return (
      <Card title={t('evaluations.acknowledgedTitle')} headingLevel={2}>
        <p className="text-sm text-fg-muted">
          {t('evaluations.acknowledgedOn', {
            date: evaluation.acknowledged_at ? format.date(evaluation.acknowledged_at.slice(0, 10)) : '—',
          })}
        </p>
        {evaluation.employee_comment ? (
          <p className="mt-2 whitespace-pre-wrap">{evaluation.employee_comment}</p>
        ) : null}
      </Card>
    );
  }
  if (evaluation.state !== 'approved') return null;

  const send = async () => {
    try {
      await acknowledge.mutateAsync({ evaluation, comment: comment.trim() === '' ? null : comment.trim() });
      toast.success(t('evaluations.acknowledged', { number: evaluation.evaluation_number }));
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      onRefused(error);
    }
  };

  return (
    <Card title={t('evaluations.acknowledgeTitle')} headingLevel={2}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fg-muted">{t('evaluations.acknowledgeBody')}</p>
        <Textarea
          label={t('evaluations.employeeComment')}
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={setComment}
        />
        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" isPending={acknowledge.isPending} onPress={() => void send()}>
            {t('evaluations.acknowledge')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
