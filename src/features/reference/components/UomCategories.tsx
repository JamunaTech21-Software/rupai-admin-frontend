import { useState } from 'react';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { lookupLabel, lookupText } from '@/lib/lookups';
import { Badge, Button, ButtonLink, Card, EmptyState, Modal, Select, toast } from '@/ui';

import { type MasterRow, rowName, useAllMasterRows, useUpdateMaster } from '../api/masters';
import { masterType } from '../masters';

const CATEGORY = masterType('uom_category');
const UOM = masterType('uom');

const baseOf = (category: MasterRow) =>
  typeof category.base_uom_id === 'string' ? category.base_uom_id : null;

/**
 * Choose a category's base unit (PATCH /lookups/uom_category/{id} { base_uom_id }). The server refuses to change
 * an existing base while other units of the category still have conversion factors against it.
 */
function BaseUnitModal({
  category,
  units,
  onClose,
  onRefused,
}: {
  readonly category: MasterRow;
  readonly units: readonly MasterRow[];
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('ref');
  const name = rowName(category);
  const update = useUpdateMaster(CATEGORY, category, name);
  const [unitId, setUnitId] = useState<string | null>(baseOf(category));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) {
      setError(t('uom.chooseBase'));
      return;
    }
    try {
      await update.mutateAsync({ base_uom_id: unit.id });
      toast.success(t('uom.baseSaved', { name, unit: rowName(unit) }));
      onClose();
    } catch (failure) {
      onClose();
      if (errorBehaviour(failure) !== 'conflict') onRefused(failure);
    }
  }

  return (
    <Modal
      isOpen
      size="sm"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('uom.baseTitle', { name })}
      description={t('uom.baseIntro')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('form.cancel')}
          </Button>
          <Button
            isPending={update.isPending}
            onPress={() => {
              void save();
            }}
          >
            {t('form.save')}
          </Button>
        </>
      }
    >
      <Select
        label={t('fields.base_uom_id')}
        isRequired
        value={unitId}
        options={units.map((unit) => ({ id: unit.id, label: lookupLabel(unit) }))}
        onChange={(value) => {
          setUnitId(value);
          setError(null);
        }}
        {...(error ? { error } : {})}
      />
    </Modal>
  );
}

/**
 * The unit categories (weight, volume, count, …) with the base unit of each. Conversion factors of a category
 * are expressed against its base unit, which is chosen here once the category has units.
 */
export function UomCategories() {
  const { t } = useTranslation('ref');
  const format = useFormat();
  const canEdit = usePermission('uom.edit');
  const categories = useAllMasterRows(CATEGORY);
  const units = useAllMasterRows(UOM);
  const [choosing, setChoosing] = useState<MasterRow | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const unitsOf = (category: MasterRow) =>
    (units.data ?? []).filter((unit) => unit.uom_category_id === category.id && unit.status === 'active');
  const pending = categories.isPending || units.isPending;
  const failed = categories.isError ? categories : units.isError ? units : null;

  return (
    <Card
      title={t('uom.categories')}
      description={t('uom.categoriesIntro')}
      headingLevel={2}
      footer={
        <div className="flex sm:justify-end">
          <ButtonLink href={CATEGORY.href} variant="secondary" className="w-full sm:w-auto">
            {t('uom.manageCategories')}
          </ButtonLink>
        </div>
      }
    >
      {pending ? (
        <PageLoading rows={3} />
      ) : failed ? (
        <PageError error={failed.error} onRetry={() => void failed.refetch()} />
      ) : (categories.data ?? []).length === 0 ? (
        <EmptyState kind="new" title={t('uom.noCategories')} description={t('uom.noCategoriesBody')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {(categories.data ?? []).map((category) => {
            const own = unitsOf(category);
            const base = (units.data ?? []).find((unit) => unit.id === baseOf(category));
            return (
              <li
                key={category.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{rowName(category)}</span>
                    <span className="font-mono text-sm text-fg-muted">{lookupText(category, 'code')}</span>
                    {category.status === 'inactive' ? (
                      <Badge tone="neutral" label={t('status.inactive')} />
                    ) : null}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {t('uom.unitCount', { count: own.length, formatted: format.number(own.length) })}
                    {' · '}
                    {base ? t('uom.baseIs', { unit: lookupLabel(base) }) : t('uom.noBase')}
                  </span>
                </div>
                {canEdit && own.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    onPress={() => {
                      setChoosing(category);
                    }}
                  >
                    {base
                      ? t('uom.changeBase', { name: rowName(category) })
                      : t('uom.setBase', { name: rowName(category) })}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {choosing ? (
        <BaseUnitModal
          key={`${choosing.id}-${String(choosing.version)}`}
          category={choosing}
          units={unitsOf(choosing)}
          onClose={() => {
            setChoosing(null);
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
    </Card>
  );
}
