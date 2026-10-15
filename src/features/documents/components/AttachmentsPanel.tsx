import { useState } from 'react';

import { PageError, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, IconButton, Skeleton, toast } from '@/ui';

import {
  type DocumentOwner,
  type DocumentRecord,
  useOwnerDocuments,
  useRemoveDocument,
} from '../api/documents';
import { type DocumentForm, DocumentFormModal } from './DocumentFormModal';
import { ExpiryBadge } from './ExpiryBadge';
import { sizeText } from './sizeText';
import { useDownload } from './useDownload';
import { VersionsDrawer } from './VersionsDrawer';

export interface AttachmentsPanelProps {
  /** The owner's API path and id: `{ path: '/factories', id: '12' }`. */
  readonly owner: DocumentOwner;
  /** The owner's permission module: `factory`, or `land` for parties. It decides who may view, change and remove. */
  readonly module: string;
  /** Document types the owner manages elsewhere (an estate's photographs): neither listed nor offered. */
  readonly excludeTypes?: readonly string[];
}

const NONE: readonly string[] = [];

/** One document: what it is, its file, when it runs out, and what the user may do with it. */
function DocumentRow({
  doc,
  canEdit,
  canDelete,
  onAction,
  onRefused,
}: {
  readonly doc: DocumentRecord;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onAction: (action: 'replace' | 'edit' | 'versions' | 'remove', doc: DocumentRecord) => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('docs');
  const format = useFormat();
  const download = useDownload(onRefused);
  const name = doc.title ?? doc.document_type.name;
  // Only the current version changes; an earlier or removed one is read and downloaded.
  const changeable = doc.is_current && doc.status === 'active';
  const button = (
    icon: 'download' | 'upload' | 'edit' | 'clock' | 'trash',
    label: string,
    onPress: () => void,
  ) => <IconButton icon={icon} variant="ghost" size="sm" label={label} onPress={onPress} />;

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{name}</span>
          {doc.title ? <Badge tone="neutral" hideIcon label={doc.document_type.name} /> : null}
          <Badge tone="neutral" hideIcon label={t('version', { number: doc.version_number })} />
          {doc.status !== 'active' ? <Badge tone="neutral" label={t(`status.${doc.status}`)} /> : null}
        </span>
        <span className="text-sm break-all text-fg-muted">
          {doc.file_name} · {sizeText(doc.file_size_bytes)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          {doc.issue_date ? <span>{t('issued', { date: format.date(doc.issue_date) })}</span> : null}
          <ExpiryBadge expiryDate={doc.expiry_date} daysToExpiry={doc.days_to_expiry} />
        </span>
        <span className="text-sm text-fg-subtle">
          {t('uploadedBy', { name: doc.uploaded_by_name, date: format.date(doc.created_at.slice(0, 10)) })}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {button('download', t('actions.download', { name }), () => {
          void download(doc);
        })}
        {button('clock', t('actions.versions', { name }), () => {
          onAction('versions', doc);
        })}
        {canEdit && changeable
          ? button('upload', t('actions.replace', { name }), () => {
              onAction('replace', doc);
            })
          : null}
        {canEdit && changeable
          ? button('edit', t('actions.edit', { name }), () => {
              onAction('edit', doc);
            })
          : null}
        {canDelete && changeable
          ? button('trash', t('actions.remove', { name }), () => {
              onAction('remove', doc);
            })
          : null}
      </div>
    </li>
  );
}

/**
 * The documents kept with a record (P1.12): licences, certificates, scans. Anyone who may view the record sees
 * them and can download; those who may change it can add, renew (replace) and correct; those who may delete it
 * can remove. Place it on a record's detail page: `<AttachmentsPanel owner={{ path: '/factories', id }} module="factory" />`.
 */
export function AttachmentsPanel({ owner, module, excludeTypes = NONE }: AttachmentsPanelProps) {
  const { t } = useTranslation('docs');
  const canEdit = usePermission(`${module}.edit`);
  const canDelete = usePermission(`${module}.delete`);
  const [history, setHistory] = useState(false);
  const documents = useOwnerDocuments(owner, history);
  const remove = useRemoveDocument();
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [versionsOf, setVersionsOf] = useState<DocumentRecord | null>(null);
  const [removing, setRemoving] = useState<DocumentRecord | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const rows = (documents.data ?? []).filter((doc) => !excludeTypes.includes(doc.document_type.code));

  const body = documents.isPending ? (
    <Skeleton variant="text" lines={4} />
  ) : documents.isError ? (
    <PageError error={documents.error} onRetry={() => void documents.refetch()} />
  ) : rows.length === 0 ? (
    <EmptyState
      kind="new"
      title={t('emptyTitle')}
      description={t('emptyBody')}
      {...(canEdit
        ? {
            action: (
              <Button
                iconStart="plus"
                onPress={() => {
                  setForm({ kind: 'add' });
                }}
              >
                {t('add')}
              </Button>
            ),
          }
        : {})}
    />
  ) : (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          canEdit={canEdit}
          canDelete={canDelete}
          onRefused={setRefusal}
          onAction={(action, target) => {
            if (action === 'remove') setRemoving(target);
            else if (action === 'versions') setVersionsOf(target);
            else setForm({ kind: action, doc: target });
          }}
        />
      ))}
    </ul>
  );

  return (
    <Card
      title={t('title')}
      description={t('intro')}
      headingLevel={2}
      actions={
        canEdit ? (
          <Button
            size="sm"
            iconStart="plus"
            onPress={() => {
              setForm({ kind: 'add' });
            }}
          >
            {t('add')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Checkbox isSelected={history} onChange={setHistory}>
          {t('showEarlier')}
        </Checkbox>
        {body}
      </div>
      {form ? (
        <DocumentFormModal
          form={form}
          owner={owner}
          excludeTypes={excludeTypes}
          onClose={() => {
            setForm(null);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      {versionsOf ? (
        <VersionsDrawer
          doc={versionsOf}
          onClose={() => {
            setVersionsOf(null);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        tone="danger"
        title={t('removeTitle', { name: removing?.title ?? removing?.document_type.name ?? '' })}
        consequence={t('removeBody')}
        confirmLabel={t('removeButton')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing);
            toast.success(t('removed'));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') setRefusal(error);
          }
          setRemoving(null);
        }}
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Card>
  );
}
