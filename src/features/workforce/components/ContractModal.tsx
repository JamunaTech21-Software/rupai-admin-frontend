import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, Modal, toast } from '@/ui';

import { checkDraft, type ContractDraft, draftOf, emptyDraft, inputOf } from '../api/contractDraft';
import {
  type Contract,
  type Contractor,
  useChangeContract,
  useCreateContract,
  useSubmitContract,
} from '../api/contractors';
import { ContractFields } from './ContractFields';

/**
 * Draft, change or renew a contractor's contract. A new contract starts from the contractor's estate; "renew" starts
 * from an earlier contract's terms with new dates. It is kept as a draft or submitted for approval at once; only an
 * approved contract counts.
 */
export function ContractModal({
  contractor,
  draft,
  renewFrom,
  onClose,
  onRefused,
}: {
  readonly contractor: Contractor;
  /** A draft being changed. */
  readonly draft: Contract | null;
  /** A contract to take the terms of (renewal): the dates are left empty. */
  readonly renewFrom: Contract | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const create = useCreateContract(contractor.id);
  const change = useChangeContract(contractor.name);
  const submit = useSubmitContract(contractor.name);
  const [value, setValue] = useState<ContractDraft>(() => {
    if (draft) return draftOf(draft);
    if (renewFrom) return { ...draftOf(renewFrom), start_date: null, end_date: null, reference_number: '' };
    return { ...emptyDraft, estate_id: contractor.registered_estate_id };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = create.isPending || change.isPending || submit.isPending;
  const messages = {
    required: t('validation.required'),
    endBeforeStart: t('validation.endBeforeStart'),
    valueForLumpSum: t('validation.valueForLumpSum'),
    retention: t('validation.retention'),
  };

  const save = async (andSubmit: boolean) => {
    const found = checkDraft(value, messages);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      const input = inputOf(value);
      const saved = draft
        ? await change.mutateAsync({ contract: draft, input })
        : await create.mutateAsync(input);
      if (andSubmit) {
        const sent = await submit.mutateAsync(saved);
        toast.success(t('contract.sent', { number: sent.contract_number }));
      } else {
        toast.success(t('contract.draftSaved', { number: saved.contract_number }));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of error.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
      onRefused(error);
      onClose();
    }
  };

  const title = draft
    ? t('contract.editTitle', { number: draft.contract_number })
    : renewFrom
      ? t('contract.renewTitle', { name: contractor.name })
      : t('contract.newTitle', { name: contractor.name });

  return (
    <Modal
      isOpen
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="secondary"
            isPending={pending}
            onPress={() => {
              void save(false);
            }}
          >
            {t('contract.saveDraft')}
          </Button>
          <Button
            isPending={pending}
            onPress={() => {
              void save(true);
            }}
          >
            {t('contract.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {renewFrom ? (
          <p className="text-sm text-fg-muted">
            {t('contract.renewHint', {
              number: renewFrom.contract_number,
              end: format.date(renewFrom.end_date),
            })}
          </p>
        ) : null}
        <ContractFields value={value} onChange={setValue} errors={errors} />
      </div>
    </Modal>
  );
}
