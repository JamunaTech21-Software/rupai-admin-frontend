import { useFormat, useTranslation } from '@/lib/i18n';

import { type Setting } from '../api/settings';

/**
 * A setting's value as text, by its type. An encrypted value is never sent to the browser: only whether one
 * is stored is shown.
 */
export function SettingValueText({ setting }: { readonly setting: Setting }) {
  const { t } = useTranslation('config');
  const format = useFormat();
  const muted = (text: string) => <span className="text-fg-muted">{text}</span>;

  if (setting.is_encrypted)
    return setting.has_value ? <span>{t('settings.secretSet')}</span> : muted(t('settings.notSet'));
  const { value } = setting;
  if (value === null || value === undefined) return muted(t('settings.notSet'));
  switch (setting.value_type) {
    case 'boolean':
      return <span>{value === true ? t('settings.on') : t('settings.off')}</span>;
    case 'integer':
      return (
        <span className="tabular-nums">
          {typeof value === 'number' ? format.number(value) : JSON.stringify(value)}
        </span>
      );
    case 'decimal':
      return (
        <span className="tabular-nums">
          {typeof value === 'string'
            ? format.decimal(value, value.split('.')[1]?.length ?? 0)
            : JSON.stringify(value)}
        </span>
      );
    case 'json':
      return <code className="font-mono text-sm break-all">{JSON.stringify(value)}</code>;
    case 'string':
      return typeof value === 'string' && value !== '' ? (
        <span className="break-words">{value}</span>
      ) : (
        muted(t('settings.empty'))
      );
  }
}
