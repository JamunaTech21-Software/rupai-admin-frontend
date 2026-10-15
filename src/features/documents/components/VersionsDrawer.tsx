import { PageError, PageLoading } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Drawer, IconButton } from '@/ui';

import { type DocumentRecord, useDocumentVersions } from '../api/documents';
import { ExpiryBadge } from './ExpiryBadge';
import { sizeText } from './sizeText';
import { useDownload } from './useDownload';

/** Every version of one document, newest first. Each file is kept, so each can be downloaded. */
export function VersionsDrawer({
  doc,
  onClose,
  onRefused,
}: {
  readonly doc: DocumentRecord;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('docs');
  const format = useFormat();
  const versions = useDocumentVersions(doc.id);
  const download = useDownload(onRefused);
  const name = doc.title ?? doc.document_type.name;

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('versions.title', { name })}
      description={t('versions.intro')}
    >
      {versions.isPending ? (
        <PageLoading rows={3} />
      ) : versions.isError ? (
        <PageError error={versions.error} onRetry={() => void versions.refetch()} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {versions.data.map((version) => (
            <li key={version.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t('version', { number: version.version_number })}</span>
                  <Badge
                    tone={version.is_current ? 'success' : 'neutral'}
                    label={t(`status.${version.status}`)}
                  />
                </span>
                <span className="text-sm break-all text-fg-muted">
                  {version.file_name} · {sizeText(version.file_size_bytes)}
                </span>
                <span className="text-sm text-fg-muted">
                  {t('uploadedBy', {
                    name: version.uploaded_by_name,
                    date: format.date(version.created_at.slice(0, 10)),
                  })}
                </span>
                <ExpiryBadge expiryDate={version.expiry_date} daysToExpiry={version.days_to_expiry} />
              </div>
              <IconButton
                icon="download"
                variant="ghost"
                size="sm"
                label={t('actions.download', {
                  name: `${name} (${t('version', { number: version.version_number })})`,
                })}
                onPress={() => {
                  void download(version);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
