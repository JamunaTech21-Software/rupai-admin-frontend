import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState, PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, type DescriptionItem, DescriptionList, PageHeader, Stack } from '@/ui';

import { type ApprovalKind, useApproval } from '../api/approvals';
import { ActionDialog } from '../components/ActionDialog';
import { ApprovalHistory } from '../components/ApprovalHistory';
import { ApprovalPath } from '../components/ApprovalPath';
import { stateTone } from '../components/stateTone';

const KINDS: readonly ApprovalKind[] = ['approve', 'reject', 'return', 'comment'];

/**
 * One approval (P1.14): the document it is about, the frozen path with where it stands, and everything done on it.
 * The buttons are the ones the server says the user may press now (`can`); each opens a confirmation that says what
 * will happen and asks for the reason where one is required. It is 404 when it is not the user's to see.
 */
export function ApprovalPage() {
  const { id } = useParams();
  const { t } = useTranslation('approvals');
  const format = useFormat();
  const query = useApproval(id);
  const [acting, setActing] = useState<ApprovalKind | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  if (id === undefined) return <NotFoundState />;
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const approval = query.data;
  const title = approval.document_number ?? approval.document_label;

  const items: DescriptionItem[] = [
    { term: t('detail.type'), description: approval.document_type_label },
    ...(approval.document_number
      ? [{ term: t('detail.document'), description: approval.document_label }]
      : []),
    ...(approval.amount === null
      ? []
      : [
          {
            term: t('detail.amount'),
            description: <span className="figures">{format.money(approval.amount)}</span>,
          },
        ]),
    ...(approval.quantity === null
      ? []
      : [
          {
            term: t('detail.quantity'),
            description: <span className="figures">{format.quantity(approval.quantity)}</span>,
          },
        ]),
    { term: t('detail.submittedBy'), description: approval.submitted_by.username },
    { term: t('detail.submittedAt'), description: format.dateTime(approval.submitted_at) },
    ...(approval.completed_at
      ? [{ term: t('detail.completedAt'), description: format.dateTime(approval.completed_at) }]
      : []),
    { term: t('detail.workflow'), description: approval.workflow_code },
  ];
  const buttons = KINDS.filter((kind) => approval.can[kind]);

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        description={approval.document_type_label}
        breadcrumbs={[{ label: t('title'), href: '/approvals' }, { label: title }]}
        status={{ tone: stateTone(approval.state), label: t(`states.${approval.state}`) }}
        actions={
          buttons.length > 0 ? (
            <span className="flex flex-wrap items-center gap-2">
              {buttons.map((kind) => (
                <Button
                  key={kind}
                  variant={kind === 'approve' ? 'primary' : kind === 'reject' ? 'danger' : 'secondary'}
                  onPress={() => {
                    setActing(kind);
                  }}
                >
                  {t(`actions.${kind}`)}
                </Button>
              ))}
            </span>
          ) : undefined
        }
      />
      {approval.guard_failure ? (
        <Alert tone="danger" title={t('detail.guardTitle')}>
          <span className="block">{approval.guard_failure.message}</span>
          <span className="block text-sm">
            {t('detail.guardWhen', { when: format.dateTime(approval.guard_failure.at) })}
          </span>
        </Alert>
      ) : null}
      {approval.is_unresolved && approval.state === 'pending' ? (
        <Alert tone="warning" title={t('detail.unresolvedTitle')}>
          {t('detail.unresolvedBody')}
        </Alert>
      ) : null}
      <Card title={t('detail.details')} headingLevel={2}>
        <DescriptionList items={items} columns={2} />
      </Card>
      <Card title={t('detail.path')} headingLevel={2}>
        <ApprovalPath steps={approval.steps} label={t('detail.path')} />
      </Card>
      <Card title={t('detail.history')} headingLevel={2}>
        {approval.actions.length > 0 ? (
          <ApprovalHistory actions={approval.actions} />
        ) : (
          <p className="text-fg-muted">{t('detail.noHistory')}</p>
        )}
      </Card>
      {acting ? (
        <ActionDialog
          approval={approval}
          kind={acting}
          onClose={() => {
            setActing(null);
          }}
          onRefused={(error) => {
            setRefusal(error);
            // The step may have moved on: show where it stands now.
            void query.refetch();
          }}
        />
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { ApprovalPage as Component };
