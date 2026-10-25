import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Skeleton,
  toast,
} from '@/ui';

import {
  type Contract,
  type Labour,
  useAddLabour,
  useChangeLabour,
  useLabour,
  useRemoveLabour,
} from '../api/contractors';

const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;

/** One labourer: their code, contact and when they are engaged, with switching them off and removing a mistake. */
function LabourRow({
  contract,
  labour,
  canEdit,
  onRefused,
}: {
  readonly contract: Contract;
  readonly labour: Labour;
  readonly canEdit: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const change = useChangeLabour(contract.id, labour.name);
  const remove = useRemoveLabour(contract.id);
  const [confirming, setConfirming] = useState(false);
  const active = labour.status === 'active';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <span className="flex flex-col">
        <span className="font-medium text-fg">{labour.name}</span>
        <span className="text-fg-muted">
          <span className="font-mono">{labour.labour_code}</span>
          {labour.phone ? ` · ${labour.phone}` : ''}
          {labour.engaged_from ? ` · ${format.date(labour.engaged_from)}` : ''}
          {labour.engaged_to ? ` – ${format.date(labour.engaged_to)}` : ''}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Badge tone={active ? 'success' : 'neutral'} label={t(`status.${labour.status}`)} />
        {canEdit ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              isPending={change.isPending}
              onPress={() => {
                void change
                  .mutateAsync({ labour, changes: { status: active ? 'inactive' : 'active' } })
                  .catch((error: unknown) => {
                    if (errorBehaviour(error) !== 'conflict') onRefused(error);
                  });
              }}
            >
              {t(active ? 'labour.deactivate' : 'labour.activate')}
              <span className="sr-only"> {labour.name}</span>
            </Button>
            <IconButton
              icon="trash"
              variant="ghost"
              size="sm"
              label={t('labour.remove', { name: labour.name })}
              onPress={() => {
                setConfirming(true);
              }}
            />
            <ConfirmDialog
              isOpen={confirming}
              onOpenChange={setConfirming}
              title={t('labour.removeTitle', { name: labour.name })}
              consequence={t('labour.removeBody')}
              confirmLabel={t('labour.removeConfirm')}
              tone="danger"
              onConfirm={async () => {
                try {
                  await remove.mutateAsync(labour);
                  toast.success(t('labour.removed', { name: labour.name }));
                } catch (error) {
                  onRefused(error);
                }
                setConfirming(false);
              }}
            />
          </>
        ) : null}
      </span>
    </li>
  );
}

/**
 * The labour a contract brings (contractor.view; changed with contractor.edit): each person with their code,
 * contact and engagement dates; add one, switch one off, remove one entered in error.
 */
export function LabourDialog({
  contract,
  onClose,
  onRefused,
}: {
  readonly contract: Contract;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canEdit =
    usePermission('contractor.edit') && ['draft', 'approved', 'submitted'].includes(contract.state);
  const list = useLabour(contract.id);
  const add = useAddLabour(contract.id);
  const [name, setName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rows = list.data ?? [];

  const submit = async () => {
    const found: Record<string, string> = {};
    if (name.trim() === '') found.name = t('validation.labourName');
    if (phone.trim() !== '' && !PHONE.test(phone.trim())) found.phone = t('validation.phone');
    if (from !== null && to !== null && to < from) found.engaged_to = t('validation.endBeforeStart');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await add.mutateAsync({
        name: name.trim(),
        national_id: nid.trim() === '' ? null : nid.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
        engaged_from: from,
        engaged_to: to,
      });
      toast.success(t('labour.added', { name: name.trim() }));
      setName('');
      setNid('');
      setPhone('');
      setFrom(null);
      setTo(null);
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const mapped: Record<string, string> = {};
        for (const detail of error.fieldErrors) if (detail.field) mapped[detail.field] = detail.message;
        setErrors(mapped);
        return;
      }
      onRefused(error);
    }
  };

  return (
    <Modal
      isOpen
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('labour.title', { number: contract.contract_number })}
      footer={
        <Button variant="secondary" onPress={onClose}>
          {t('labour.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {list.isPending ? (
          <Skeleton variant="table-row" columns={3} rows={3} />
        ) : list.isError ? (
          <p className="text-sm text-danger">{t('labour.failed')}</p>
        ) : rows.length === 0 ? (
          <EmptyState kind="new" title={t('labour.emptyTitle')} description={t('labour.emptyBody')} />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <LabourRow
                key={row.id}
                contract={contract}
                labour={row}
                canEdit={canEdit}
                onRefused={onRefused}
              />
            ))}
          </ul>
        )}
        {canEdit ? (
          <form
            noValidate
            className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-line pt-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <h3 className="text-sm font-medium text-fg sm:col-span-2">{t('labour.addTitle')}</h3>
            <Input
              label={t('labour.name')}
              placeholder={t('labour.placeholders.name')}
              isRequired
              value={name}
              onChange={setName}
              {...(errors.name ? { error: errors.name } : {})}
            />
            <Input label={t('labour.nationalId')} value={nid} onChange={setNid} />
            <Input
              label={t('labour.phone')}
              type="tel"
              placeholder="+8801711000000"
              value={phone}
              onChange={setPhone}
              {...(errors.phone ? { error: errors.phone } : {})}
            />
            <span className="hidden sm:block" />
            <DatePicker label={t('labour.from')} value={from} onChange={setFrom} />
            <DatePicker
              label={t('labour.to')}
              value={to}
              onChange={setTo}
              {...(errors.engaged_to ? { error: errors.engaged_to } : {})}
            />
            <div className="sm:col-span-2">
              <Button type="submit" isPending={add.isPending}>
                {t('labour.add')}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}
