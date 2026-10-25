import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Link,
  Modal,
  Skeleton,
  Textarea,
  toast,
} from '@/ui';

import {
  type Contract,
  type Contractor,
  useContractorContracts,
  useDeleteContract,
  useSubmitContract,
  useTerminateContract,
} from '../api/contractors';
import { ContractModal } from './ContractModal';
import { LabourDialog } from './LabourDialog';

const TONES: Record<Contract['status'], BadgeTone> = {
  pending: 'warning',
  upcoming: 'info',
  active: 'success',
  completed: 'neutral',
  terminated: 'neutral',
  rejected: 'danger',
};
const todayIso = () => new Date().toISOString().slice(0, 10);

/** End an approved contract early: the last day of work (not before it started) and why. */
function TerminateDialog({
  contract,
  contractor,
  onClose,
  onRefused,
}: {
  readonly contract: Contract;
  readonly contractor: Contractor;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const terminate = useTerminateContract(contractor.name);
  const [last, setLast] = useState<string | null>(todayIso());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async () => {
    const found: Record<string, string> = {};
    if (last === null) found.terminated_on = t('validation.required');
    else if (last < contract.start_date) found.terminated_on = t('validation.beforeStart');
    if (reason.trim().length < 3) found.reason = t('validation.reason');
    setErrors(found);
    if (Object.keys(found).length > 0 || last === null) return;
    try {
      await terminate.mutateAsync({ contract, terminated_on: last, reason: reason.trim() });
      toast.success(t('contract.terminated', { number: contract.contract_number }));
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
      title={t('contract.terminateTitle', { number: contract.contract_number })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            isPending={terminate.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('contract.terminate')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-muted">{t('contract.terminateWarning')}</p>
        <DatePicker
          label={t('contract.lastDay')}
          isRequired
          value={last}
          onChange={setLast}
          {...(errors.terminated_on ? { error: errors.terminated_on } : {})}
        />
        <Textarea
          label={t('contract.terminationReason')}
          rows={3}
          maxLength={500}
          isRequired
          value={reason}
          onChange={setReason}
          {...(errors.reason ? { error: errors.reason } : {})}
        />
      </div>
    </Modal>
  );
}

/** One contract: its terms, where it stands, and what can be done to it by whom. */
function ContractRow({
  contract,
  contractor,
  onEdit,
  onRenew,
  onLabour,
  onTerminate,
  onRefused,
}: {
  readonly contract: Contract;
  readonly contractor: Contractor;
  readonly onEdit: () => void;
  readonly onRenew: () => void;
  readonly onLabour: () => void;
  readonly onTerminate: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('contractor.create');
  const canEdit = usePermission('contractor.edit');
  const canDelete = usePermission('contractor.delete');
  const canApprove = usePermission('contractor.approve');
  const submit = useSubmitContract(contractor.name);
  const remove = useDeleteContract();
  const [confirming, setConfirming] = useState(false);
  const draft = contract.state === 'draft';
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium text-fg">{contract.contract_number}</span>
          {contract.reference_number ? (
            <span className="text-sm text-fg-muted">{contract.reference_number}</span>
          ) : null}
        </span>
        <Badge tone={TONES[contract.status]} label={t(`contractStatus.${contract.status}`)} />
      </div>
      <p className="text-sm text-fg">
        {t(`workTypes.${contract.work_type}`)} · {contract.estate.name}
      </p>
      <p className="text-sm text-fg-muted">
        {format.date(contract.start_date)} – {format.date(contract.end_date)} ·{' '}
        {t('contract.months', { count: format.number(contract.duration_months) })}
        {contract.status === 'active'
          ? ` · ${t('contract.daysLeft', { count: format.number(contract.days_left) })}`
          : ''}
      </p>
      <p className="text-sm text-fg-muted">
        {t(`rateBases.${contract.rate_basis}`)} {format.money(contract.rate)}
        {contract.contract_value ? ` · ${t('contract.value')} ${format.money(contract.contract_value)}` : ''}
        {contract.payment_terms ? ` · ${t(`paymentTerms.${contract.payment_terms}`)}` : ''}
      </p>
      {contract.state === 'submitted' && contract.approval_id ? (
        <p className="text-sm">
          <span className="text-fg-muted">{t('contract.waiting')} </span>
          <Link href={`/approvals/${contract.approval_id}`}>{t('contract.openApproval')}</Link>
        </p>
      ) : null}
      {contract.state === 'rejected' && contract.rejection_reason ? (
        <p className="text-sm text-danger">
          {t('contract.rejectedBecause', { reason: contract.rejection_reason })}
        </p>
      ) : null}
      {contract.state === 'terminated' && contract.terminated_on ? (
        <p className="text-sm text-fg-muted">
          {t('contract.terminatedOn', {
            date: format.date(contract.terminated_on),
            reason: contract.termination_reason ?? '',
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onPress={onLabour}>
          {t('contract.labour', { count: format.number(contract.labour_count) })}
          <span className="sr-only"> {contract.contract_number}</span>
        </Button>
        {draft && canCreate ? (
          <Button
            size="sm"
            isPending={submit.isPending}
            onPress={() => {
              void submit
                .mutateAsync(contract)
                .then((sent) => {
                  toast.success(t('contract.sent', { number: sent.contract_number }));
                })
                .catch((error: unknown) => {
                  if (errorBehaviour(error) !== 'conflict') onRefused(error);
                });
            }}
          >
            {t('contract.submit')}
            <span className="sr-only"> {contract.contract_number}</span>
          </Button>
        ) : null}
        {draft && canEdit ? (
          <Button size="sm" variant="secondary" onPress={onEdit}>
            {t('contract.edit')}
            <span className="sr-only"> {contract.contract_number}</span>
          </Button>
        ) : null}
        {draft && canDelete ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setConfirming(true);
              }}
            >
              {t('contract.delete')}
              <span className="sr-only"> {contract.contract_number}</span>
            </Button>
            <ConfirmDialog
              isOpen={confirming}
              onOpenChange={setConfirming}
              title={t('contract.deleteTitle', { number: contract.contract_number })}
              consequence={t('contract.deleteBody')}
              confirmLabel={t('contract.delete')}
              tone="danger"
              onConfirm={async () => {
                try {
                  await remove.mutateAsync(contract);
                  toast.success(t('contract.deleted', { number: contract.contract_number }));
                } catch (error) {
                  onRefused(error);
                }
                setConfirming(false);
              }}
            />
          </>
        ) : null}
        {contract.state === 'approved' && canApprove ? (
          <Button size="sm" variant="secondary" onPress={onTerminate}>
            {t('contract.terminate')}
            <span className="sr-only"> {contract.contract_number}</span>
          </Button>
        ) : null}
        {canCreate && ['approved', 'terminated'].includes(contract.state) ? (
          <Button size="sm" variant="secondary" onPress={onRenew}>
            {t('contract.renew')}
            <span className="sr-only"> {contract.contract_number}</span>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A contractor's contracts (contractor.view), latest first: new, renew, change a draft and send it for approval, end an
 * approved one, and the labour on each. Only an approved contract counts; a submitted one waits for an approver.
 */
export function ContractsPanel({
  contractor,
  onRefused,
}: {
  readonly contractor: Contractor;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canCreate = usePermission('contractor.create') && contractor.status !== 'blacklisted';
  const list = useContractorContracts(contractor.id);
  const [editor, setEditor] = useState<{ draft: Contract | null; renewFrom: Contract | null } | null>(null);
  const [labourOf, setLabourOf] = useState<Contract | null>(null);
  const [ending, setEnding] = useState<Contract | null>(null);
  const rows = list.data ?? [];

  return (
    <>
      <Card
        title={t('contract.title')}
        headingLevel={2}
        {...(canCreate
          ? {
              actions: (
                <Button
                  size="sm"
                  iconStart="plus"
                  onPress={() => {
                    setEditor({ draft: null, renewFrom: null });
                  }}
                >
                  {t('contract.new')}
                </Button>
              ),
            }
          : {})}
      >
        {list.isPending ? (
          <Skeleton variant="table-row" columns={3} rows={3} />
        ) : list.isError ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-danger">{t('contract.failed')}</span>
            <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
              {t('employment.retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState kind="new" title={t('contract.emptyTitle')} description={t('contract.emptyBody')} />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <ContractRow
                key={row.id}
                contract={row}
                contractor={contractor}
                onEdit={() => {
                  setEditor({ draft: row, renewFrom: null });
                }}
                onRenew={() => {
                  setEditor({ draft: null, renewFrom: row });
                }}
                onLabour={() => {
                  setLabourOf(row);
                }}
                onTerminate={() => {
                  setEnding(row);
                }}
                onRefused={onRefused}
              />
            ))}
          </ul>
        )}
      </Card>
      {editor ? (
        <ContractModal
          contractor={contractor}
          draft={editor.draft}
          renewFrom={editor.renewFrom}
          onClose={() => {
            setEditor(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
      {labourOf ? (
        <LabourDialog
          contract={labourOf}
          onClose={() => {
            setLabourOf(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
      {ending ? (
        <TerminateDialog
          contract={ending}
          contractor={contractor}
          onClose={() => {
            setEnding(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </>
  );
}
