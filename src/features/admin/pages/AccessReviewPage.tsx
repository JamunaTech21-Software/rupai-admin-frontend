import { type ReactNode } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Accordion, Badge, Button, Card, EmptyState, Icon, Link, PageHeader, Stack } from '@/ui';

import { useConcentrationReport, useSodRules } from '../api/access';
import { type ConcentrationReport } from '../api/schemas';
import { useUserDirectory } from '../api/users';
import { KindBadge, PermissionChips } from '../components/SodParts';

const userHref = (id: string, tab?: string) => `/admin/users/${id}${tab ? `?tab=${tab}` : ''}`;

/** A section of the review: a card with a heading, a one-line intro, and its rows or a calm "none" line. */
function Section({
  title,
  intro,
  isEmpty,
  none,
  children,
}: {
  readonly title: string;
  readonly intro: string;
  readonly isEmpty: boolean;
  readonly none: string;
  readonly children: ReactNode;
}) {
  return (
    <Card title={title} description={intro} headingLevel={2}>
      {isEmpty ? <p className="text-fg-muted">{none}</p> : children}
    </Card>
  );
}

/** The review's top: what nobody signed off. Shown first and loudest (P6 §9.1). */
function Unauthorised({ rows }: { readonly rows: ConcentrationReport['unauthorised'] }) {
  const { t } = useTranslation('admin');
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          kind="done"
          title={t('access.unauthorisedNoneTitle')}
          description={t('access.unauthorisedNoneBody')}
        />
      </Card>
    );
  }
  return (
    <section
      aria-labelledby="unauthorised-heading"
      className="flex flex-col gap-4 rounded-lg border-2 border-danger bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="unauthorised-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
          <Icon name="alert" className="text-danger" />
          {t('access.unauthorisedTitle')}
          <Badge tone="danger" label={String(rows.reduce((n, row) => n + row.requirements.length, 0))} />
        </h2>
        <p className="text-sm text-fg-muted">{t('access.unauthorisedIntro')}</p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
            <Link href={userHref(row.id, 'roles')} className="self-start font-medium">
              {t('access.review', { username: row.username })}
            </Link>
            <ul className="flex flex-col gap-3">
              {row.requirements.map((requirement) => (
                <li key={requirement.key} className="flex flex-col gap-2 ps-3 sm:ps-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindBadge kind={requirement.kind} />
                    <span className="text-sm text-fg-muted">{requirement.rule}</span>
                  </div>
                  <p className="font-medium text-fg">{requirement.title}</p>
                  <p className="text-sm text-fg-muted">{requirement.why}</p>
                  <PermissionChips
                    permissions={requirement.permissions}
                    label={t('sod.permissionsInvolved')}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overrides({ rows }: { readonly rows: ConcentrationReport['active_overrides'] }) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const directory = useUserDirectory();
  const name = (id: string) => directory.data?.get(id) ?? t('authorisations.unknownUser', { id });
  return (
    <Section
      title={t('access.overridesTitle')}
      intro={t('access.overridesIntro')}
      isEmpty={rows.length === 0}
      none={t('access.overridesNone')}
    >
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={userHref(row.user.id, 'authorisations')} className="font-medium">
                {row.user.username}
              </Link>
              <KindBadge kind={row.kind} />
              <span className="text-sm text-fg-muted">{row.rule}</span>
              {row.still_held ? null : <Badge tone="neutral" label={t('access.notHeld')} />}
            </div>
            <PermissionChips permissions={row.permissions} label={t('sod.permissionsInvolved')} />
            <p className="text-fg">{row.reason}</p>
            <p className="text-sm text-fg-muted">
              {t('authorisations.authorisedBy', {
                name: name(row.authorised_by),
                date: format.dateTime(row.authorised_at),
              })}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SensitiveHolders({ rows }: { readonly rows: ConcentrationReport['sensitive_holders'] }) {
  const { t } = useTranslation('admin');
  return (
    <Section
      title={t('access.sensitiveTitle')}
      intro={t('access.sensitiveIntro')}
      isEmpty={rows.length === 0}
      none={t('access.sensitiveNone')}
    >
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li key={row.permission} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <code className="rounded self-start bg-surface-subtle px-2 py-0.5 font-mono text-sm text-fg">
              {row.permission}
            </code>
            <p className="text-sm text-fg-muted">{row.why}</p>
            <ul className="flex flex-wrap gap-2">
              {row.holders.map((holder) => (
                <li key={holder.id}>
                  <Link
                    href={userHref(holder.id, holder.authorised ? 'authorisations' : 'roles')}
                    className={
                      holder.authorised
                        ? 'inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-sm'
                        : 'inline-flex items-center gap-1 rounded-full border border-danger px-2 py-0.5 text-sm'
                    }
                  >
                    <Icon
                      name={holder.authorised ? 'check' : 'alert'}
                      size="sm"
                      className={holder.authorised ? 'text-success' : 'text-danger'}
                    />
                    {holder.username}
                    <span className="sr-only">
                      {holder.authorised ? t('access.authorised') : t('access.notAuthorised')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A list of users, each with a set of tags (modules, roles). */
function UserTags({
  title,
  intro,
  none,
  rows,
}: {
  readonly title: string;
  readonly intro: string;
  readonly none: string;
  readonly rows: readonly { id: string; username: string; tags: readonly string[] }[];
}) {
  return (
    <Section title={title} intro={intro} isEmpty={rows.length === 0} none={none}>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
          >
            <Link href={userHref(row.id, 'roles')} className="font-medium sm:w-48 sm:shrink-0">
              {row.username}
            </Link>
            <ul className="flex flex-wrap gap-2">
              {row.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-surface-subtle px-2 py-0.5 text-sm text-fg">
                  {tag}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Rules() {
  const { t } = useTranslation('admin');
  const canSeeRules = usePermission('role.view');
  const rules = useSodRules(canSeeRules);
  if (!canSeeRules) return null;
  return (
    <Card title={t('access.rulesTitle')} description={t('access.rulesIntro')} headingLevel={2}>
      {rules.isPending ? (
        <PageLoading rows={3} />
      ) : rules.isError ? (
        <PageError error={rules.error} onRetry={() => void rules.refetch()} />
      ) : (
        <Accordion
          allowsMultipleExpanded
          headingLevel={3}
          items={rules.data.map((rule) => ({
            id: rule.code,
            title: `${rule.code} · ${rule.title}`,
            summary: t('access.combinations', { count: rule.combinations.length }),
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-fg-muted">{rule.why}</p>
                <ul className="flex flex-col gap-2">
                  {rule.combinations.map((combination) => (
                    <li key={combination.join('+')}>
                      <PermissionChips permissions={combination} label={rule.title} />
                    </li>
                  ))}
                </ul>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
}

/** Admin → Access review (P1.04 concentration report): what to look at first, then the full picture. */
export function AccessReviewPage() {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const report = useConcentrationReport();

  const refresh = (
    <Button
      variant="secondary"
      iconStart="refresh"
      isPending={report.isFetching}
      onPress={() => {
        void report.refetch();
      }}
    >
      {t('access.refresh')}
    </Button>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('access.title')}
        description={
          report.data
            ? t('access.generatedAt', { date: format.dateTime(report.data.generated_at) })
            : t('access.description')
        }
        actions={refresh}
      />
      {report.isPending ? (
        <PageLoading />
      ) : report.isError ? (
        <PageError error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <p className="max-w-prose text-fg-muted">{t('access.description')}</p>
          <Unauthorised rows={report.data.unauthorised} />
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            <Overrides rows={report.data.active_overrides} />
            <SensitiveHolders rows={report.data.sensitive_holders} />
            <UserTags
              title={t('access.approvePostTitle')}
              intro={t('access.approvePostIntro')}
              none={t('access.approvePostNone')}
              rows={report.data.approve_and_post.map((row) => ({ ...row, tags: row.modules }))}
            />
            <UserTags
              title={t('access.manyRolesTitle')}
              intro={t('access.manyRolesIntro')}
              none={t('access.manyRolesNone')}
              rows={report.data.users_with_many_roles.map((row) => ({ ...row, tags: row.roles }))}
            />
          </div>
          <Rules />
        </>
      )}
    </Stack>
  );
}

export { AccessReviewPage as Component };
