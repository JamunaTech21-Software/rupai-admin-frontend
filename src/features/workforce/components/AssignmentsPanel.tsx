import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, Card, ConfirmDialog, EmptyState, Link, Skeleton, toast } from '@/ui';

import {
  type Assignment,
  useAssignments,
  useDeleteAssignment,
  useSubmitAssignment,
} from '../api/assignments';
import { type Profile } from '../api/profileSchemas';
import { AssignmentModal, type AssignmentEditor } from './AssignmentModal';

const TONES: Record<Assignment['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** Draft actions of one row: submit it, change it, delete it, each for those who may. */
function DraftActions({
  profile,
  assignment,
  onEdit,
  onRefused,
}: {
  readonly profile: Profile;
  readonly assignment: Assignment;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('employment.create');
  const canEdit = usePermission('employment.edit');
  const canDelete = usePermission('employment.delete');
  const submit = useSubmitAssignment(profile.id, profile.profile_number);
  const remove = useDeleteAssignment(profile.id, assignment);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCreate ? (
        <Button
          size="sm"
          isPending={submit.isPending}
          onPress={() => {
            void submit
              .mutateAsync(assignment)
              .then((result) => {
                toast.success(
                  t(result.state === 'submitted' ? 'assignments.sentForApproval' : 'assignments.inEffect', {
                    date: format.date(result.effective_from),
                  }),
                );
              })
              .catch((error: unknown) => {
                if (errorBehaviour(error) !== 'conflict') onRefused(error);
              });
          }}
        >
          {t('assignments.submit')}
        </Button>
      ) : null}
      {canEdit ? (
        <Button size="sm" variant="secondary" onPress={onEdit}>
          {t('assignments.edit')}
        </Button>
      ) : null}
      {canDelete ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setConfirming(true);
            }}
          >
            {t('assignments.delete')}
          </Button>
          <ConfirmDialog
            isOpen={confirming}
            onOpenChange={setConfirming}
            title={t('assignments.deleteTitle')}
            consequence={t('assignments.deleteBody')}
            confirmLabel={t('assignments.delete')}
            tone="danger"
            onConfirm={async () => {
              try {
                await remove.mutateAsync();
                toast.success(t('assignments.deleted'));
              } catch (error) {
                onRefused(error);
              }
              setConfirming(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** One assignment on the timeline: its period, what changed, the pay, and where it stands. */
function TimelineRow({
  profile,
  assignment,
  onEdit,
  onRefused,
}: {
  readonly profile: Profile;
  readonly assignment: Assignment;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const where =
    profile.employment_type === 'employee'
      ? [assignment.department?.name, assignment.designation?.name]
      : [assignment.section?.name, assignment.activity_type?.name];
  const period = `${format.date(assignment.effective_from)} – ${
    assignment.effective_to ? format.date(assignment.effective_to) : t('assignments.present')
  }`;
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{period}</span>
          {assignment.is_current ? <Badge tone="success" label={t('assignments.current')} /> : null}
        </span>
        <span className="flex items-center gap-2">
          <Badge tone="neutral" label={t(`changeReasons.${assignment.change_reason}`)} />
          <Badge tone={TONES[assignment.state]} label={t(`assignmentStates.${assignment.state}`)} />
        </span>
      </div>
      <p className="text-sm text-fg">{where.filter(Boolean).join(' · ') || t('form.notRecorded')}</p>
      <p className="text-sm text-fg-muted">
        {t(`wageBases.${assignment.wage_basis}`)}
        {assignment.base_rate ? ` · ${t('assignments.rate')} ${format.money(assignment.base_rate)}` : ''}
        {assignment.total_pay ? ` · ${t('assignments.totalPay')} ${format.money(assignment.total_pay)}` : ''}
        {assignment.is_wage_change && assignment.state !== 'approved'
          ? ` · ${t('assignments.needsApproval')}`
          : ''}
      </p>
      {assignment.remarks ? <p className="text-sm text-fg-muted">{assignment.remarks}</p> : null}
      {assignment.state === 'rejected' && assignment.rejection_reason ? (
        <p className="text-sm text-danger">
          {t('assignments.rejectedBecause', { reason: assignment.rejection_reason })}
        </p>
      ) : null}
      {assignment.state === 'submitted' && assignment.approval_id ? (
        <p className="text-sm">
          <Link href={`/approvals/${assignment.approval_id}`}>{t('assignments.openApproval')}</Link>
        </p>
      ) : null}
      {assignment.state === 'draft' ? (
        <DraftActions profile={profile} assignment={assignment} onEdit={onEdit} onRefused={onRefused} />
      ) : null}
    </li>
  );
}

/**
 * The profile's Assignments tab (employment.view): the effective-dated timeline of where and on what terms the
 * person works, latest first, and the way to make a change (employment.create). Only one change can be pending at a
 * time; a change in pay waits for an approver.
 */
export function AssignmentsPanel({
  profile,
  onRefused,
}: {
  readonly profile: Profile;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canCreate = usePermission('employment.create') && profile.status !== 'separated';
  const list = useAssignments(profile.id);
  const [editor, setEditor] = useState<AssignmentEditor | null>(null);
  const rows = list.data ?? [];
  const current = rows.find((row) => row.is_current) ?? null;
  const pending = rows.find((row) => row.state === 'draft' || row.state === 'submitted') ?? null;
  const isFirst = list.isSuccess && rows.length === 0;

  return (
    <>
      <Card
        title={t('assignments.title')}
        headingLevel={2}
        {...(canCreate
          ? {
              actions: (
                <Button
                  size="sm"
                  iconStart="plus"
                  isDisabled={!list.isSuccess || pending !== null}
                  onPress={() => {
                    setEditor({ draft: null, current });
                  }}
                >
                  {t(isFirst ? 'assignments.addFirst' : 'assignments.newChange')}
                </Button>
              ),
            }
          : {})}
      >
        {pending ? <p className="mb-3 text-sm text-fg-muted">{t('assignments.onePending')}</p> : null}
        {list.isPending ? (
          <Skeleton variant="table-row" columns={3} rows={3} />
        ) : list.isError ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-danger">{t('assignments.failed')}</span>
            <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
              {t('employment.retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            kind="new"
            title={t('assignments.emptyTitle')}
            description={t('assignments.emptyBody')}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <TimelineRow
                key={row.id}
                profile={profile}
                assignment={row}
                onEdit={() => {
                  setEditor({ draft: row, current });
                }}
                onRefused={onRefused}
              />
            ))}
          </ul>
        )}
      </Card>
      {editor ? (
        <AssignmentModal
          profile={profile}
          editor={editor}
          isFirst={isFirst}
          onClose={() => {
            setEditor(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </>
  );
}
