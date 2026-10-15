import { type ReactNode } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { PageHeader, Stack } from '@/ui';

import { useEstate } from '../api/hierarchy';
import { type Estate } from '../api/schemas';
import { type EstateTab, EstateTabs } from './EstateTabs';

/**
 * One tab of an estate (R.3): the estate's name and status, the Estate Management tab bar, then the tab's own
 * content. The estate is read once here and handed to the content.
 */
export function EstateScreen({
  estateId,
  current,
  title,
  children,
}: {
  readonly estateId: string;
  readonly current: EstateTab;
  /** The tab's name, for the breadcrumbs. */
  readonly title: string;
  readonly children: (estate: Estate) => ReactNode;
}) {
  const { t } = useTranslation('org');
  const estate = useEstate(estateId);
  if (estate.isPending) return <PageLoading />;
  if (estate.isError) return <PageError error={estate.error} onRetry={() => void estate.refetch()} />;
  const { data } = estate;
  return (
    <Stack gap={6}>
      <PageHeader
        title={data.name}
        description={data.code}
        status={{ tone: data.status === 'active' ? 'success' : 'neutral', label: t(`status.${data.status}`) }}
        breadcrumbs={[
          { label: t('estate.backToList'), href: '/estates' },
          { label: data.name, href: `/estates/${data.id}` },
          { label: title },
        ]}
      />
      <EstateTabs estateId={data.id} current={current} />
      {children(data)}
    </Stack>
  );
}
