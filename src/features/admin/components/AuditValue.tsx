import { useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Button, cx } from '@/ui';

const SHORT = 60;

/** JSON text (a list, an object, a create/delete snapshot) pretty-printed; anything else as it came. */
function readable(value: string): { text: string } {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { text: JSON.stringify(JSON.parse(trimmed), null, 2) };
    } catch {
      // Not JSON after all: show it as text.
    }
  }
  return { text: value };
}

/**
 * One audited value. Short values show inline; long ones and snapshots show a preview and a "Show all" toggle,
 * so a table of changes stays scannable. `tone="old"` marks the before value.
 */
export function AuditValue({ value, tone }: { readonly value: string | null; readonly tone: 'old' | 'new' }) {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  if (value === null || value === '') return <span className="text-fg-subtle">{t('audit.empty')}</span>;
  const { text } = readable(value);
  // Collapse only what is long; a short list such as ["ADMINISTRATOR"] reads fine inline.
  const isLong = value.length > SHORT;
  const style = tone === 'old' ? 'text-fg-muted line-through decoration-fg-subtle' : 'text-fg';
  if (!isLong) return <span className={cx('break-words', style)}>{text}</span>;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {open ? (
        <pre className="rounded max-h-72 max-w-full overflow-auto bg-surface-subtle p-2 font-mono text-xs whitespace-pre-wrap text-fg">
          {text}
        </pre>
      ) : (
        <span className={cx('line-clamp-2 break-all', style)}>{value}</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onPress={() => {
          setOpen((current) => !current);
        }}
      >
        {open ? t('audit.showLess') : t('audit.showAll')}
      </Button>
    </div>
  );
}
