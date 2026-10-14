import { useId } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Drawer, EmptyState, Stack } from '@/ui';

import { type NumberFormat, useNextNumber, useNumberSequences } from '../api/numbering';
import { scopeParts } from '../numbering';

/** A counter's scope in words: "Estate EST · Fiscal year FY2026-27", or "All documents". */
function ScopeLabel({ scopeKey }: { readonly scopeKey: string }) {
  const { t } = useTranslation('config');
  return (
    <>
      {scopeParts(scopeKey)
        .map((part) =>
          part.kind === 'all'
            ? t('numbering.scope.all')
            : t(`numbering.scope.${part.kind}`, { value: part.value }),
        )
        .join(' · ')}
    </>
  );
}

/**
 * The counters of one document type, read-only: the next number in the sample scope, and the last number
 * allocated in every scope so far. A counter only moves when a document takes a number.
 */
export function CountersDrawer({
  format,
  onClose,
}: {
  readonly format: NumberFormat;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation('config');
  const fmt = useFormat();
  const next = useNextNumber(format);
  const sequences = useNumberSequences(format.id);
  const nextId = useId();
  const countersId = useId();

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('numbering.counters.title', { name: format.label })}
      description={t('numbering.counters.intro')}
    >
      <Stack gap={6}>
        <section aria-labelledby={nextId} className="flex flex-col gap-1">
          <h3 id={nextId} className="text-sm font-medium text-fg-muted">
            {t('numbering.counters.next')}
          </h3>
          {next.isPending ? (
            <PageLoading rows={1} />
          ) : next.isError ? (
            <PageError error={next.error} onRetry={() => void next.refetch()} />
          ) : (
            <>
              <p className="font-mono text-lg break-all text-fg">{next.data.next_number}</p>
              <p className="text-sm text-fg-muted">{t('numbering.counters.nextNote')}</p>
            </>
          )}
        </section>
        <section aria-labelledby={countersId} className="flex flex-col gap-2">
          <h3 id={countersId} className="text-sm font-medium text-fg-muted">
            {t('numbering.counters.byScope')}
          </h3>
          {sequences.isPending ? (
            <PageLoading rows={3} />
          ) : sequences.isError ? (
            <PageError error={sequences.error} onRetry={() => void sequences.refetch()} />
          ) : sequences.data.length === 0 ? (
            <EmptyState
              kind="new"
              title={t('numbering.counters.emptyTitle')}
              description={t('numbering.counters.emptyBody')}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {sequences.data.map((sequence) => (
                <li
                  key={sequence.scope_key}
                  className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="text-fg">
                    <ScopeLabel scopeKey={sequence.scope_key} />
                  </span>
                  <span className="flex flex-col sm:items-end">
                    <span className="font-medium text-fg tabular-nums">
                      {t('numbering.counters.last', { number: fmt.decimal(sequence.last_number, 0) })}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {t('numbering.counters.updated', { when: fmt.dateTime(sequence.updated_at) })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Stack>
    </Drawer>
  );
}
