import { useState } from 'react';

import { PageError } from '@/features/system';
import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { lookupText, useActiveLookups } from '@/lib/lookups';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FileUpload,
  IconButton,
  Select,
  Skeleton,
  toast,
  type UploadFile,
} from '@/ui';

import {
  type EstatePhoto,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  PHOTOGRAPH,
  useEstatePhotos,
  usePhotoUrl,
  useRemovePhoto,
  useUploadPhoto,
} from '../api/estateProfile';

const TITLES = ['garden', 'factory', 'gate', 'other'] as const;
type TitleKey = (typeof TITLES)[number];

/** One photograph, through its short-lived link. */
function Photo({
  photo,
  estateName,
  canRemove,
  onRemove,
}: {
  readonly photo: EstatePhoto;
  readonly estateName: string;
  readonly canRemove: boolean;
  readonly onRemove: () => void;
}) {
  const { t } = useTranslation('org');
  const url = usePhotoUrl(photo.id);
  const title = photo.title ?? t('profile.untitled');
  return (
    <li className="relative overflow-hidden rounded-lg border border-line bg-surface-subtle">
      {url.data ? (
        <img src={url.data} alt={`${title} · ${estateName}`} className="h-28 w-full object-cover" />
      ) : (
        <Skeleton variant="block" className="h-28 w-full" />
      )}
      <p className="truncate px-2 py-1 text-xs text-fg-muted">{title}</p>
      {canRemove ? (
        <IconButton
          icon="trash"
          size="sm"
          variant="secondary"
          label={t('profile.removePhoto', { title })}
          className="absolute end-1 top-1"
          onPress={onRemove}
        />
      ) : null}
    </li>
  );
}

/**
 * Estate Images (R.2): the estate's photographs (documents of type Photograph) as a gallery, with an upload for
 * those who may edit. Upload and removal happen at once, not with the profile's Save.
 */
export function EstatePhotos({
  estateId,
  estateName,
  canEdit,
  onRefused,
}: {
  readonly estateId: string;
  readonly estateName: string;
  readonly canEdit: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const photos = useEstatePhotos(estateId);
  const types = useActiveLookups('document_type', canEdit);
  const upload = useUploadPhoto(estateId);
  const remove = useRemovePhoto(estateId);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [titleKey, setTitleKey] = useState<TitleKey>('garden');
  const [missingFile, setMissingFile] = useState(false);
  const [removing, setRemoving] = useState<EstatePhoto | null>(null);
  const photographType = (types.data ?? []).find((row) => lookupText(row, 'code') === PHOTOGRAPH);

  async function add() {
    const file = files[0]?.file;
    if (!file) {
      setMissingFile(true);
      return;
    }
    if (!photographType) return;
    try {
      await upload.mutateAsync({
        file,
        title: t(`profile.photoTitles.${titleKey}`),
        documentTypeId: photographType.id,
      });
      setFiles([]);
      toast.success(t('profile.uploaded'));
    } catch (error) {
      onRefused(error);
    }
  }

  const gallery = photos.isPending ? (
    <Skeleton variant="block" className="h-28 w-full" />
  ) : photos.isError ? (
    <PageError error={photos.error} onRetry={() => void photos.refetch()} />
  ) : photos.data.length === 0 ? (
    <EmptyState kind="new" title={t('profile.noPhotos')} description={t('profile.noPhotosBody')} />
  ) : (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.data.map((photo) => (
        <Photo
          key={photo.id}
          photo={photo}
          estateName={estateName}
          canRemove={canEdit}
          onRemove={() => {
            setRemoving(photo);
          }}
        />
      ))}
    </ul>
  );

  return (
    <Card title={t('profile.images')} description={t('profile.imagesIntro')} headingLevel={2}>
      <div className="flex flex-col gap-4">
        {gallery}
        {canEdit && !types.isPending && !photographType ? (
          <Alert tone="warning">{t('profile.noPhotoType')}</Alert>
        ) : null}
        {canEdit && photographType ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <FileUpload
              label={t('profile.photoFile')}
              accept={PHOTO_TYPES}
              maxSizeBytes={PHOTO_MAX_BYTES}
              files={files}
              onFilesChange={(next) => {
                setFiles(next.slice(-1));
                setMissingFile(false);
              }}
              {...(missingFile ? { error: t('profile.choosePhoto') } : {})}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select
                label={t('profile.photoTitle')}
                className="w-full sm:w-56"
                value={titleKey}
                options={TITLES.map((key) => ({ id: key, label: t(`profile.photoTitles.${key}`) }))}
                onChange={(value) => {
                  const key = TITLES.find((option) => option === value);
                  if (key) setTitleKey(key);
                }}
              />
              <Button
                iconStart="upload"
                isPending={upload.isPending}
                className="w-full sm:w-auto"
                onPress={() => {
                  void add();
                }}
              >
                {t('profile.upload')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        tone="danger"
        title={t('profile.removeTitle')}
        consequence={t('profile.removeBody')}
        confirmLabel={t('profile.removeButton')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing);
            toast.success(t('profile.removed'));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setRemoving(null);
        }}
      />
    </Card>
  );
}
