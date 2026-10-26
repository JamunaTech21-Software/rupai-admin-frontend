import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import { Badge, type BadgeTone, Button, ConfirmDialog, Modal, MoneyInput, Textarea, toast } from '@/ui';

import { useCloseCase, useDeleteCase, useDisburse, type WelfareCase } from '../api/benefits';

const TONES: Record<WelfareCase['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  closed: 'neutral',
};

/** Draft / Waiting for approval / Approved / Rejected / Closed. */
export function CaseStateBadge({ state }: { readonly state: WelfareCase['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[state]} label={t(`caseStates.${state}`)} />;
}

/**
 * What can be done to a case (welfare.edit / welfare.delete): delete a draft; on an approved one, record a payment up
 * to what remains, and close it with the outcome. Changing and submitting a draft are on the form.
 */
export function WelfareActions({
  welfareCase,
  onDeleted,
  onRefused,
}: {
  readonly welfareCase: WelfareCase;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canEdit = usePermission('welfare.edit');
  const canDelete = usePermission('welfare.delete');
  const remove = useDeleteCase();
  const disburse = useDisburse(welfareCase.case_number);
  const close = useCloseCase(welfareCase.case_number);
  const [asking, setAsking] = useState<'delete' | 'pay' | 'close' | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const [error, setError] = useState<string | null>(null);
  const number = welfareCase.case_number;

  const done = () => {
    setAsking(null);
    setAmount(null);
    setOutcome('');
    setError(null);
  };
  const pay = async () => {
    if (amount === null || new Dec(amount).lte(0)) {
      setError(t('validation.amountPaid'));
      return;
    }
    try {
      await disburse.mutateAsync({ welfareCase, amount });
      toast.success(t('welfare.paid', { number }));
      done();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
        setError(failure.fieldErrors[0]?.message ?? failure.message);
        return;
      }
      onRefused(failure);
      done();
    }
  };
  const finish = async () => {
    if (outcome.trim().length < 3) {
      setError(t('validation.reason'));
      return;
    }
    try {
      await close.mutateAsync({ welfareCase, outcome: outcome.trim() });
      toast.success(t('welfare.closed', { number }));
      done();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      done();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {welfareCase.state === 'draft' && canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('welfare.delete')}
        </Button>
      ) : null}
      {welfareCase.state === 'approved' && canEdit ? (
        <>
          <Button
            onPress={() => {
              setAsking('pay');
            }}
          >
            {t('welfare.pay')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              setAsking('close');
            }}
          >
            {t('welfare.close')}
          </Button>
        </>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) done();
        }}
        title={t('welfare.deleteTitle', { number })}
        consequence={t('welfare.deleteBody')}
        confirmLabel={t('welfare.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(welfareCase);
            toast.success(t('welfare.deleted', { number }));
            onDeleted();
          } catch (failure) {
            onRefused(failure);
          }
          done();
        }}
      />
      {asking === 'pay' ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) done();
          }}
          title={t('welfare.payTitle', { number })}
          footer={
            <>
              <Button variant="secondary" onPress={done}>
                {t('actions.cancel')}
              </Button>
              <Button
                isPending={disburse.isPending}
                onPress={() => {
                  void pay();
                }}
              >
                {t('welfare.pay')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg-muted">
              {t('welfare.remaining', {
                amount: welfareCase.remaining_amount
                  ? format.money(welfareCase.remaining_amount)
                  : format.money('0'),
              })}
            </p>
            <MoneyInput
              label={t('welfare.amountPaid')}
              isRequired
              value={amount}
              onChange={setAmount}
              {...(error ? { error } : {})}
            />
          </div>
        </Modal>
      ) : null}
      {asking === 'close' ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) done();
          }}
          title={t('welfare.closeTitle', { number })}
          footer={
            <>
              <Button variant="secondary" onPress={done}>
                {t('actions.cancel')}
              </Button>
              <Button
                isPending={close.isPending}
                onPress={() => {
                  void finish();
                }}
              >
                {t('welfare.close')}
              </Button>
            </>
          }
        >
          <Textarea
            label={t('welfare.outcome')}
            placeholder={t('welfare.placeholders.outcome')}
            rows={3}
            maxLength={500}
            isRequired
            value={outcome}
            onChange={setOutcome}
            {...(error ? { error } : {})}
          />
        </Modal>
      ) : null}
    </div>
  );
}
