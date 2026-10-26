import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, ConfirmDialog, DatePicker, Link, Modal, Textarea, toast } from '@/ui';

import {
  type BenefitEntitlement,
  useDeleteEntitlement,
  useSubmitEntitlement,
  useWithdrawEntitlement,
} from '../api/benefits';

const TONES: Record<BenefitEntitlement['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Draft / Waiting for approval / Approved / Rejected / Withdrawn. */
export function EntitlementStateBadge({ state }: { readonly state: BenefitEntitlement['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[state]} label={t(`entitlementStates.${state}`)} />;
}

/** End an approved entitlement (benefit.approve): its last day and why. */
function WithdrawDialog({
  entitlement,
  onClose,
  onRefused,
}: {
  readonly entitlement: BenefitEntitlement;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const withdraw = useWithdrawEntitlement(entitlement.profile.full_name);
  const [last, setLast] = useState<string | null>(todayIso());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async () => {
    const found: Record<string, string> = {};
    if (last === null) found.effective_to = t('validation.required');
    else if (last < entitlement.effective_from) found.effective_to = t('validation.beforeStart');
    if (reason.trim().length < 3) found.reason = t('validation.reason');
    setErrors(found);
    if (Object.keys(found).length > 0 || last === null) return;
    try {
      await withdraw.mutateAsync({ entitlement, effective_to: last, reason: reason.trim() });
      toast.success(t('benefits.withdrawn', { name: entitlement.profile.full_name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      onRefused(error);
      onClose();
    }
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('benefits.withdrawTitle', { name: entitlement.profile.full_name })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            isPending={withdraw.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('benefits.withdraw')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <DatePicker
          label={t('benefits.lastDay')}
          isRequired
          value={last}
          onChange={setLast}
          {...(errors.effective_to ? { error: errors.effective_to } : {})}
        />
        <Textarea
          label={t('actions.reason')}
          placeholder={t('actions.reasonPlaceholder')}
          rows={3}
          maxLength={300}
          isRequired
          value={reason}
          onChange={setReason}
          {...(errors.reason ? { error: errors.reason } : {})}
        />
      </div>
    </Modal>
  );
}

/**
 * What can be done to an entitlement, each for those who may: submit a draft (benefit.submit), change it
 * (benefit.edit), delete it (benefit.delete), withdraw an approved one (benefit.approve); a submitted one links to its
 * approval.
 */
export function EntitlementActions({
  entitlement,
  onEdit,
  onRefused,
}: {
  readonly entitlement: BenefitEntitlement;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canSubmit = usePermission('benefit.submit');
  const canEdit = usePermission('benefit.edit');
  const canDelete = usePermission('benefit.delete');
  const canApprove = usePermission('benefit.approve');
  const submit = useSubmitEntitlement(entitlement.profile.full_name);
  const remove = useDeleteEntitlement();
  const [asking, setAsking] = useState<'delete' | 'withdraw' | null>(null);
  const name = entitlement.profile.full_name;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {entitlement.state === 'draft' && canSubmit ? (
        <Button
          size="sm"
          isPending={submit.isPending}
          onPress={() => {
            void submit
              .mutateAsync(entitlement)
              .then(() => {
                toast.success(t('benefits.sent', { name }));
              })
              .catch((error: unknown) => {
                if (errorBehaviour(error) !== 'conflict') onRefused(error);
              });
          }}
        >
          {t('benefits.submit')}
          <span className="sr-only"> {name}</span>
        </Button>
      ) : null}
      {entitlement.state === 'draft' && canEdit ? (
        <Button size="sm" variant="secondary" onPress={onEdit}>
          {t('benefits.edit')}
          <span className="sr-only"> {name}</span>
        </Button>
      ) : null}
      {entitlement.state === 'draft' && canDelete ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setAsking('delete');
            }}
          >
            {t('benefits.delete')}
            <span className="sr-only"> {name}</span>
          </Button>
          <ConfirmDialog
            isOpen={asking === 'delete'}
            onOpenChange={(open) => {
              if (!open) setAsking(null);
            }}
            title={t('benefits.deleteTitle', { name })}
            consequence={t('benefits.deleteBody')}
            confirmLabel={t('benefits.delete')}
            tone="danger"
            onConfirm={async () => {
              try {
                await remove.mutateAsync(entitlement);
                toast.success(t('benefits.deleted', { name }));
              } catch (error) {
                onRefused(error);
              }
              setAsking(null);
            }}
          />
        </>
      ) : null}
      {entitlement.state === 'approved' && canApprove ? (
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            setAsking('withdraw');
          }}
        >
          {t('benefits.withdraw')}
          <span className="sr-only"> {name}</span>
        </Button>
      ) : null}
      {entitlement.state === 'submitted' && entitlement.approval_id ? (
        <Link href={`/approvals/${entitlement.approval_id}`}>
          {t('benefits.openApproval')}
          <span className="sr-only"> {name}</span>
        </Link>
      ) : null}
      {asking === 'withdraw' ? (
        <WithdrawDialog
          entitlement={entitlement}
          onClose={() => {
            setAsking(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </span>
  );
}
