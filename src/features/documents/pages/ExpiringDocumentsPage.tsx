import { useState } from 'react';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { lookupText, useActiveLookups } from '@/lib/lookups';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  type DataColumn,
  DataTable,
  DatePicker,
  EmptyState,
  IconButton,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import {
  DOCUMENT_OWNERS,
  type DocumentOwnerType,
  type ExpiringDocument,
  useExpiringDocuments,
} from '../api/documents';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { useDownload } from '../components/useDownload';

const ANY = 'any';
const FROM = filterKey('expiry_date', 'from');
const TO = filterKey('expiry_date', 'to');
const OWNER_TYPE = filterKey('owner_type');
const DOCUMENT_TYPE = filterKey('document_type_id');

/** The page of a record that holds a document, from its type and id. */
const ownerHref = (doc: ExpiringDocument) => {
  const owner = DOCUMENT_OWNERS.find((o) => o.type === doc.owner_type);
  return owner ? `${owner.path}/${doc.owner_id}` : null;
};

/**
 * Documents about to expire, or already expired, across every record the user may see (P1.12). Without dates it
 * shows the next 30 days, soonest first; choosing dates looks further. Each row names its record and links to it.
 */
export function ExpiringDocumentsPage() {
  const { t } = useTranslation('docs');
  const format = useFormat();
  const canReadTypes = usePermission('lookup.view');
  const list = useExpiringDocuments();
  const { table } = list;
  const types = useActiveLookups('document_type', canReadTypes);
  const [refusal, setRefusal] = useState<unknown>(null);
  const download = useDownload(setRefusal);

  const ownerLabel = (type: string) => t(`expiring.ownerTypes.${type as DocumentOwnerType}`);

  const columns: DataColumn<ExpiringDocument>[] = [
    {
      id: 'document',
      header: t('expiring.columns.document'),
      cell: (doc) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium">{doc.title ?? doc.document_type.name}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            {doc.title ? <span>{doc.document_type.name}</span> : null}
            <Badge tone="neutral" hideIcon label={t('version', { number: doc.version_number })} />
          </span>
        </span>
      ),
    },
    {
      id: 'belongs_to',
      header: t('expiring.columns.belongsTo'),
      cell: (doc) => {
        const href = ownerHref(doc);
        return (
          <span className="flex flex-col">
            {href ? <Link href={href}>{doc.owner_label}</Link> : <span>{doc.owner_label}</span>}
            <span className="text-sm text-fg-muted">{ownerLabel(doc.owner_type)}</span>
          </span>
        );
      },
    },
    {
      id: 'expires',
      header: t('expiring.columns.expires'),
      cell: (doc) => (
        <span className="flex flex-col items-start gap-1">
          <ExpiryBadge expiryDate={doc.expiry_date} daysToExpiry={doc.days_to_expiry} />
          {doc.expiry_date ? (
            <span className="text-sm text-fg-muted">{format.date(doc.expiry_date)}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'file',
      header: t('expiring.columns.file'),
      canHide: true,
      isHiddenByDefault: true,
      cell: (doc) => <span className="text-sm break-all">{doc.file_name}</span>,
    },
    {
      id: 'actions',
      header: t('expiring.columns.actions'),
      align: 'center',
      cell: (doc) => (
        <IconButton
          icon="download"
          variant="ghost"
          size="sm"
          label={t('actions.download', { name: doc.title ?? doc.document_type.name })}
          onPress={() => {
            void download(doc);
          }}
        />
      ),
    },
  ];

  const typeOptions = (types.data ?? []).map((row) => ({
    id: row.id,
    label: lookupText(row, 'name') || lookupText(row, 'code'),
  }));

  return (
    <Stack gap={6}>
      <PageHeader title={t('expiring.title')} description={t('expiring.description')} />
      <DataTable
        label={t('expiring.title')}
        columns={columns}
        getRowId={(doc) => doc.id}
        getRowLabel={(doc) => doc.title ?? doc.document_type.name}
        storageKey="documents-expiring"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('expiring.itemLabel') }}
        toolbar={
          <>
            <DatePicker
              label={t('expiring.from')}
              className="w-full sm:w-48"
              value={table.filters[FROM] ?? null}
              onChange={(date) => {
                table.setFilter(FROM, date);
              }}
            />
            <DatePicker
              label={t('expiring.to')}
              className="w-full sm:w-48"
              value={table.filters[TO] ?? null}
              onChange={(date) => {
                table.setFilter(TO, date);
              }}
            />
            <Select
              label={t('expiring.ownerType')}
              className="w-full sm:w-44"
              value={table.filters[OWNER_TYPE] ?? ANY}
              options={[
                { id: ANY, label: t('expiring.anyOwner') },
                ...DOCUMENT_OWNERS.map((owner) => ({ id: owner.type, label: ownerLabel(owner.type) })),
              ]}
              onChange={(value) => {
                table.setFilter(OWNER_TYPE, value === null || value === ANY ? null : value);
              }}
            />
            {typeOptions.length > 0 ? (
              <Select
                label={t('expiring.type')}
                className="w-full sm:w-52"
                value={table.filters[DOCUMENT_TYPE] ?? ANY}
                options={[{ id: ANY, label: t('expiring.anyType') }, ...typeOptions]}
                onChange={(value) => {
                  table.setFilter(DOCUMENT_TYPE, value === null || value === ANY ? null : value);
                }}
              />
            ) : null}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('expiring.emptyFilteredTitle')}
              description={t('expiring.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('expiring.clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('expiring.emptyTitle')} description={t('expiring.emptyBody')} />
          )
        }
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { ExpiringDocumentsPage as Component };
