import { type DocumentRecord, useDownloadLink } from '../api/documents';

/**
 * Downloads a document. The signed link lives for a few minutes, so it is asked for at the click and followed at
 * once, never kept. Following it through an anchor with a file name saves the file without leaving the page.
 */
export function useDownload(onRefused: (error: unknown) => void) {
  const link = useDownloadLink();
  return async (doc: Pick<DocumentRecord, 'id'>) => {
    try {
      const { url, file_name } = await link.mutateAsync(doc);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = file_name;
      anchor.rel = 'noopener';
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      onRefused(error);
    }
  };
}
