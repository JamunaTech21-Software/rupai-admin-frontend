import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState, PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useMe, usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  type DescriptionItem,
  DescriptionList,
  Link,
  PageHeader,
  Stack,
  toast,
} from '@/ui';

import { useDocumentTypeList, useEstateChoices, useWorkflow, useWorkflowAction } from '../api/workflows';
import { ConditionText } from '../components/ConditionText';
import { LifecycleDialog } from '../components/LifecycleDialog';
import { PreviewPanel } from '../components/PreviewPanel';
import { StepList } from '../components/StepList';
import { stateTone } from '../components/stateTone';

/**
 * One workflow version (P1.13): its details, the conditions under which it applies, its steps with the server's
 * warnings, and the preview panel. What can be done depends on its state and the user's permissions: a draft can be
 * edited and submitted (workflow.edit); a submitted one approved, rejected or returned by someone other than its
 * creator (workflow.approve); an active one gets a next version (workflow.create).
 */
export function WorkflowPage() {
  const { id } = useParams();
  const { t } = useTranslation('workflows');
  const format = useFormat();
  const me = useMe();
  const canEdit = usePermission('workflow.edit');
  const canApprove = usePermission('workflow.approve');
  const canCreate = usePermission('workflow.create');
  const query = useWorkflow(id);
  const types = useDocumentTypeList();
  const estates = useEstateChoices();
  const { mutation: submit } = useWorkflowAction({ id: id ?? '' });
  const [deciding, setDeciding] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  if (id === undefined) return <NotFoundState />;
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const workflow = query.data;
  const documentType = types.data?.find((type) => type.key === workflow.document_type);
  const isCreator = me?.user.id === workflow.created_by;
  const estate = workflow.estate_id
    ? (estates.data?.find((row) => row.id === workflow.estate_id)?.name ??
      t('estateNumber', { id: workflow.estate_id }))
    : t('scopeAll');
  const general = (workflow.warnings ?? []).filter((warning) => warning.step_number === null);

  const items: DescriptionItem[] = [
    { term: t('detail.type'), description: workflow.document_type_label },
    { term: t('detail.scope'), description: estate },
    {
      term: t('detail.effective'),
      description: workflow.effective_to
        ? t('period', { from: format.date(workflow.effective_from), to: format.date(workflow.effective_to) })
        : t('periodOpen', { from: format.date(workflow.effective_from) }),
    },
    ...(workflow.supersedes_id
      ? [
          {
            term: t('detail.supersedes'),
            description: (
              <Link href={`/admin/workflows/${workflow.supersedes_id}`}>{t('detail.earlier')}</Link>
            ),
          },
        ]
      : []),
    { term: t('detail.createdAt'), description: format.dateTime(workflow.created_at) },
    ...(workflow.submitted_at
      ? [{ term: t('detail.submittedAt'), description: format.dateTime(workflow.submitted_at) }]
      : []),
    ...(workflow.approved_at
      ? [{ term: t('detail.approvedAt'), description: format.dateTime(workflow.approved_at) }]
      : []),
    ...(workflow.notes ? [{ term: t('detail.notes'), description: workflow.notes }] : []),
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={workflow.name}
        description={t('detail.subtitle', { code: workflow.code, version: workflow.version })}
        breadcrumbs={[{ label: t('title'), href: '/admin/workflows' }, { label: workflow.name }]}
        status={{ tone: stateTone(workflow.state), label: t(`states.${workflow.state}`) }}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {workflow.state === 'draft' && canEdit ? (
              <>
                <ButtonLink
                  href={`/admin/workflows/${workflow.id}/edit`}
                  variant="secondary"
                  iconStart="edit"
                >
                  {t('actions.edit')}
                </ButtonLink>
                <Button
                  onPress={() => {
                    setConfirmingSubmit(true);
                  }}
                >
                  {t('actions.submit')}
                </Button>
              </>
            ) : null}
            {workflow.state === 'submitted' && canApprove ? (
              <>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setDeciding('return');
                  }}
                >
                  {t('actions.return')}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setDeciding('reject');
                  }}
                >
                  {t('actions.reject')}
                </Button>
                {isCreator ? null : (
                  <Button
                    onPress={() => {
                      setDeciding('approve');
                    }}
                  >
                    {t('actions.approve')}
                  </Button>
                )}
              </>
            ) : null}
            {workflow.state === 'active' && canCreate ? (
              <ButtonLink href={`/admin/workflows/${workflow.id}/new-version`} iconStart="copy">
                {t('actions.newVersion')}
              </ButtonLink>
            ) : null}
          </span>
        }
      />
      {workflow.state === 'rejected' && workflow.rejection_reason ? (
        <Alert tone="danger" title={t('detail.rejectedTitle')}>
          {workflow.rejection_reason}
        </Alert>
      ) : null}
      {workflow.state === 'submitted' && canApprove && isCreator ? (
        <Alert tone="info" title={t('detail.ownTitle')}>
          {t('detail.ownBody')}
        </Alert>
      ) : null}
      {workflow.is_retrospective && workflow.state !== 'active' ? (
        <Alert tone="warning" title={t('detail.retroTitle')}>
          {t('detail.retroBody')}
        </Alert>
      ) : null}
      {general.map((warning) => (
        <Alert key={warning.code} tone="warning" title={t('detail.warning')}>
          {warning.message}
        </Alert>
      ))}
      <Card title={t('detail.details')} headingLevel={2}>
        <DescriptionList items={items} columns={2} />
      </Card>
      {workflow.conditions.length > 0 ? (
        <Card title={t('detail.conditions')} description={t('detail.conditionsIntro')} headingLevel={2}>
          <ul className="list-disc ps-5 text-fg">
            {workflow.conditions.map((condition) => (
              <li key={`${condition.field}-${condition.operator}`}>
                <ConditionText condition={condition} documentType={documentType} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card title={t('detail.steps')} headingLevel={2}>
        <StepList workflow={workflow} documentType={documentType} />
      </Card>
      <PreviewPanel workflowId={workflow.id} documentType={documentType} />
      <ConfirmDialog
        isOpen={confirmingSubmit}
        onOpenChange={setConfirmingSubmit}
        title={t('lifecycle.submit.title', { name: workflow.name })}
        consequence={t('lifecycle.submit.body')}
        confirmLabel={t('lifecycle.submit.confirm')}
        onConfirm={async () => {
          try {
            await submit.mutateAsync({ action: 'submit', text: '' });
            toast.success(t('lifecycle.submit.done', { name: workflow.name }));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') setRefusal(error);
          }
          setConfirmingSubmit(false);
        }}
      />
      {deciding ? (
        <LifecycleDialog
          workflow={workflow}
          action={deciding}
          onClose={() => {
            setDeciding(null);
          }}
          onRefused={setRefusal}
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

export { WorkflowPage as Component };
