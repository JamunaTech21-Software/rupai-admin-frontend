import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Button, DatePicker, Modal, Select, Stack, Textarea, toast } from '@/ui';

import { useDivisions, useReassignField, useSections } from '../api/hierarchy';
import { type Field } from '../api/schemas';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Move a field to another section of the same estate, from a date (POST /fields/{id}/reassign-section). The
 * section is effective-dated: history keeps the old one. The date may not be in the future, nor before the field
 * joined its current section; the server's field messages say which.
 */
export function MoveFieldModal({
  field,
  onClose,
  onRefused,
}: {
  readonly field: Field;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const reassign = useReassignField(field);
  const divisions = useDivisions(field.estate_id);
  const [divisionId, setDivisionId] = useState(field.division_id);
  const sections = useSections(divisionId);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(todayIso());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const offered = (sections.data ?? []).filter((s) => s.id !== field.section_id && s.status === 'active');

  async function save() {
    const next: Record<string, string> = {};
    if (!sectionId) next.section_id = t('validation.choose', { field: t('field.newSection').toLowerCase() });
    if (!date)
      next.effective_from = t('validation.required', { field: t('field.effectiveFrom').toLowerCase() });
    else if (date > todayIso()) next.effective_from = t('validation.notFuture');
    setErrors(next);
    if (Object.keys(next).length > 0 || !sectionId || !date) return;
    try {
      await reassign.mutateAsync({
        section_id: sectionId,
        effective_from: date,
        ...(reason.trim().length >= 3 ? { reason: reason.trim() } : {}),
      });
      const name = offered.find((s) => s.id === sectionId)?.name ?? '';
      toast.success(t('field.moved', { section: name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (isApiError(error) && error.fieldErrors.length > 0) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((detail) => [detail.field ?? '', detail.message])),
        );
        return;
      }
      onRefused(error);
    }
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('field.moveTitle', { number: field.field_number })}
      description={t('field.moveIntro')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={reassign.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('field.move')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <Select
          label={t('field.division')}
          value={divisionId}
          options={(divisions.data ?? []).map((d) => ({ id: d.id, label: `${d.code} · ${d.name}` }))}
          onChange={(value) => {
            if (value) {
              setDivisionId(value);
              setSectionId(null);
            }
          }}
        />
        <Select
          label={t('field.newSection')}
          isRequired
          placeholder={t('field.choose')}
          value={sectionId}
          options={offered.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))}
          onChange={setSectionId}
          {...(errors.section_id ? { error: errors.section_id } : {})}
        />
        <DatePicker
          label={t('field.effectiveFrom')}
          hint={t('field.effectiveHint')}
          isRequired
          value={date}
          onChange={setDate}
          {...(errors.effective_from ? { error: errors.effective_from } : {})}
        />
        <Textarea
          label={t('field.reason')}
          hint={t('field.reasonHint')}
          rows={2}
          maxLength={500}
          value={reason}
          onChange={setReason}
          {...(errors.reason ? { error: errors.reason } : {})}
        />
      </Stack>
    </Modal>
  );
}
