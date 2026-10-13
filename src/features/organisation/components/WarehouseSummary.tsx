import { useFormat, useTranslation } from '@/lib/i18n';
import { StatCard } from '@/ui';

import { useContacts } from '../api/facilities';
import { type Warehouse } from '../api/schemas';

import { LicenceWarning } from './LicenceWarning';

/**
 * The warehouse at a glance: its type, capacity, primary contact and licence expiry, with a warning under the
 * cards when the licence has expired or expires within 30 days. The primary contact comes from the contacts list
 * (the same one the Contacts panel below shows), so the two always agree.
 */
export function WarehouseSummary({ warehouse }: { readonly warehouse: Warehouse }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const contacts = useContacts({ path: 'warehouses', id: warehouse.id });
  const primary = contacts.data?.find((contact) => contact.is_primary);
  const notRecorded = t('estates.notRecorded');

  return (
    <section aria-label={t('warehouse.summary')} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('warehouse.type')} value={t(`warehouseType.${warehouse.warehouse_type}`)} />
        <StatCard
          label={t('warehouse.capacity')}
          value={warehouse.capacity_kg ? format.decimal(warehouse.capacity_kg, 3) : notRecorded}
          {...(warehouse.capacity_kg ? { unit: 'kg' } : {})}
        />
        <StatCard
          label={t('warehouse.primaryContact')}
          value={contacts.isPending ? '…' : (primary?.contact_name ?? notRecorded)}
        />
        <StatCard
          label={t('warehouse.licenceExpiry')}
          value={warehouse.licence_expiry ? format.date(warehouse.licence_expiry) : notRecorded}
        />
      </div>
      <LicenceWarning expiry={warehouse.licence_expiry} />
    </section>
  );
}
