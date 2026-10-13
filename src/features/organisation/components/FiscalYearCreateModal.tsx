import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Button, Modal, NumberInput, toast } from '@/ui';

import { useCreateFiscalYear } from '../api/calendar';
import { type FiscalYear } from '../api/schemas';

/**
 * Add a fiscal year: only the calendar year it starts in is asked. The server works out the dates from the
 * organisation's start month and names the year; an overlap comes back on the start year.
 */
export function FiscalYearCreateModal({
  suggestedYear,
  onClose,
  onCreated,
  onRefused,
}: {
  readonly suggestedYear: number;
  readonly onClose: () => void;
  readonly onCreated: (year: FiscalYear) => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const create = useCreateFiscalYear();
  const [startYear, setStartYear] = useState<number | null>(suggestedYear);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (startYear === null || !Number.isInteger(startYear) || startYear < 1990 || startYear > 2200) {
      setError(t('fiscalYear.yearRange'));
      return;
    }
    setError(null);
    try {
      const created = await create.mutateAsync({ start_year: startYear });
      toast.success(t('fiscalYear.created', { name: created.name }));
      onCreated(created);
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') {
        onClose();
        return;
      }
      const detail = isApiError(failure)
        ? failure.fieldErrors.find((d) => d.field === 'start_year')
        : undefined;
      if (detail) {
        setError(detail.message);
        return;
      }
      onRefused(failure);
    }
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('fiscalYear.newTitle')}
      description={t('fiscalYear.newIntro')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={create.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('fiscalYear.create')}
          </Button>
        </>
      }
    >
      <NumberInput
        label={t('fiscalYear.startYear')}
        hint={t('fiscalYear.startYearHint')}
        isRequired
        minValue={1990}
        maxValue={2200}
        formatOptions={{ useGrouping: false }}
        value={startYear}
        onChange={setStartYear}
        {...(error ? { error } : {})}
      />
    </Modal>
  );
}
