import { useTranslation } from '@/lib/i18n';
import { EmptyState, PageHeader, Stack } from '@/ui';

export interface ComingSoonProps {
  readonly screen: 'users' | 'roles' | 'audit';
  /** The Jira phase that builds it: "P1.01". */
  readonly phase: string;
}

/**
 * A screen whose route, navigation entry and permission guard exist but whose content arrives with a later
 * phase. Keeps the sidebar honest: every entry opens a page.
 */
export function ComingSoon({ screen, phase }: ComingSoonProps) {
  const { t } = useTranslation('nav');
  const { t: tc } = useTranslation('common');
  const title = t(screen);
  return (
    <Stack gap={6}>
      <PageHeader title={title} />
      <EmptyState
        kind="new"
        size="page"
        title={tc('comingSoonTitle', { screen: title })}
        description={tc('comingSoonBody', { phase })}
      />
    </Stack>
  );
}
