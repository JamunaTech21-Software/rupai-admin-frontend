import { useMe } from '@/lib/auth';
import { config } from '@/lib/env';
import { useFormat, useTranslation } from '@/lib/i18n';
import { describeMockSetting, mockSetting } from '@/lib/mocks';
import { Card, DescriptionList, PageHeader, Stack } from '@/ui';

/**
 * The dashboard. Modules add their headline figures here as they arrive; for now it shows who is signed in,
 * what they may do and where the app is connected.
 */
export function HomePage() {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const me = useMe();
  const roles = (me?.user.roles ?? []).map((role) => role.name).join(', ');
  const scope = me?.scope.all_estates
    ? tc('allEstates')
    : tc('estateScoped', { count: me?.scope.estates?.length ?? 0 });

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={me ? t('welcome', { name: me.user.username }) : undefined}
      />
      <p className="max-w-prose text-fg-muted">{t('intro')}</p>
      <Card title={tc('appName')} className="max-w-3xl">
        <DescriptionList
          columns={2}
          items={[
            {
              term: t('signedInAs'),
              description: me ? `${me.user.username}${roles ? ` · ${roles}` : ''}` : null,
            },
            {
              term: t('permissions'),
              description: t('permissionsCount', { count: format.number(me?.permissions.length ?? 0) }),
            },
            { term: t('scope'), description: scope },
            { term: t('environment'), description: config.mode },
            {
              term: t('apiAddress'),
              description: <code className="font-mono text-sm">{config.apiBaseUrl}</code>,
            },
            { term: t('mockedApis'), description: describeMockSetting(mockSetting) },
          ]}
        />
      </Card>
    </Stack>
  );
}

export { HomePage as Component };
