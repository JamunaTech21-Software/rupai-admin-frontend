import { useFormat, useTranslation } from '@/lib/i18n';
import { StatCard } from '@/ui';

import { useContacts } from '../api/facilities';
import { type Party } from '../api/schemas';

/**
 * The party at a glance: its type, district, primary contact and number of contacts. Both contact cards read the
 * contacts list (the same one the Contacts panel below shows), so they always agree with it.
 */
export function PartySummary({ party }: { readonly party: Party }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const contacts = useContacts({ path: 'parties', id: party.id });
  const primary = contacts.data?.find((contact) => contact.is_primary);
  const notRecorded = t('estates.notRecorded');

  return (
    <section aria-label={t('party.summary')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('party.type')} value={t(`partyType.${party.party_type}`)} />
        <StatCard label={t('party.district')} value={party.district ?? notRecorded} />
        <StatCard
          label={t('party.primaryContact')}
          value={contacts.isPending ? '…' : (primary?.contact_name ?? notRecorded)}
        />
        <StatCard
          label={t('contacts.title')}
          value={contacts.data ? format.number(contacts.data.length) : '…'}
        />
      </div>
    </section>
  );
}
