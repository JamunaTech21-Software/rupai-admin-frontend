import { useTranslation } from '@/lib/i18n';
import { type Job } from '@/lib/query';
import { Link } from '@/ui';

/** A value that points at something to download or open: an address on the API or the web. */
const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && (value.startsWith('/') || /^https?:\/\//.test(value));

/** "download_url" → "Download url": a result's field names are the API's, shown as plain words. */
const words = (key: string) => {
  const text = key.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * What a finished job produced: its summary, a link to what it made, or the report of what it refused. The fields
 * are the job's own, so each is shown by name: an address becomes a link, a number or text as is, anything
 * larger (a list of refused rows) as formatted JSON.
 */
export function JobResult({ result }: { readonly result: NonNullable<Job['result']> }) {
  const { t } = useTranslation('jobs');
  const entries = Object.entries(result);
  if (entries.length === 0) return <p className="text-sm text-fg-muted">{t('detail.noResult')}</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(8rem,14rem)_1fr]">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-sm text-fg-muted">{words(key)}</dt>
          <dd className="min-w-0 text-fg">
            {isAddress(value) ? (
              <Link href={value} isExternal>
                {t('detail.downloadResult')}
              </Link>
            ) : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? (
              <span className="break-words">{String(value)}</span>
            ) : (
              <pre className="max-h-64 overflow-auto rounded-md bg-surface-subtle p-3 font-mono text-sm">
                {JSON.stringify(value, null, 2)}
              </pre>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
