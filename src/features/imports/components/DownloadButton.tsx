import { useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Button } from '@/ui';

import { saveFile, type SheetFormat } from '../api/imports';

/**
 * Saves a file the API builds (a template, an error report) in one format. A refusal is passed up, so the page shows
 * it in its own dialog; the button waits while the file is fetched.
 */
export function DownloadButton({
  path,
  format,
  fallbackName,
  label,
  onRefused,
}: {
  readonly path: string;
  readonly format: SheetFormat;
  readonly fallbackName: string;
  readonly label: string;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('imports');
  const [isPending, setIsPending] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      iconStart="download"
      isPending={isPending}
      aria-label={t('downloadAs', { label, format: format.toUpperCase() })}
      onPress={() => {
        setIsPending(true);
        saveFile(path, format, fallbackName)
          .catch(onRefused)
          .finally(() => {
            setIsPending(false);
          });
      }}
    >
      {format.toUpperCase()}
    </Button>
  );
}
