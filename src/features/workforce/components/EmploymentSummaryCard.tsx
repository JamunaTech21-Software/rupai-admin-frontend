import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { ButtonLink, Card, DescriptionList, Link, Skeleton } from '@/ui';

import { usePersonProfiles } from '../api/profiles';
import { ProfileStatusBadge } from './ProfileActions';

/**
 * The person's current employment on their own page (the design's Employment Information): the profile in force, or
 * the latest one, with what the assignment says about where they work, and the way to open it or to add one. Shown
 * to those who may see employment (employment.view).
 */
export function EmploymentSummaryCard({ personId }: { readonly personId: string }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canView = usePermission('employment.view');
  const canCreate = usePermission('employment.create');
  const profiles = usePersonProfiles(personId);
  if (!canView) return null;
  const rows = profiles.data ?? [];
  const profile = rows.find((row) => row.status !== 'separated') ?? rows[0] ?? null;
  const none = t('form.notRecorded');
  const assignment = profile?.current_assignment ?? null;

  return (
    <Card
      title={t('person.sections.employment')}
      headingLevel={2}
      {...(profile
        ? {
            actions: (
              <ButtonLink href={`/workforce/profiles/${profile.id}`} size="sm" variant="secondary">
                {t('person.employmentOpen')}
              </ButtonLink>
            ),
          }
        : canCreate
          ? {
              actions: (
                <ButtonLink href={`/workforce/profiles/new?person=${personId}`} size="sm" iconStart="plus">
                  {t('person.employmentAdd')}
                </ButtonLink>
              ),
            }
          : {})}
    >
      {profiles.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={2} />
      ) : profiles.isError ? (
        <p className="text-sm text-danger">{t('employment.failed')}</p>
      ) : profile === null ? (
        <p className="text-sm text-fg-muted">{t('person.employmentNone')}</p>
      ) : (
        <DescriptionList
          columns={3}
          items={[
            {
              term: t(`form.profileNumber.${profile.employment_type}`),
              description: (
                <Link href={`/workforce/profiles/${profile.id}`} className="font-mono">
                  {profile.profile_number}
                </Link>
              ),
            },
            { term: t('form.employmentType'), description: t(`employmentTypes.${profile.employment_type}`) },
            { term: t('form.estate'), description: `${profile.estate.code} · ${profile.estate.name}` },
            {
              term: t('profiles.columns.status'),
              description: <ProfileStatusBadge status={profile.status} />,
            },
            { term: t('form.joiningDate'), description: format.date(profile.joining_date) },
            { term: t('form.engagement'), description: t(`engagement.${profile.engagement_type}`) },
            { term: t('form.category'), description: profile.category?.name ?? none },
            {
              term: t('form.basis'),
              description: profile.employment_basis ? t(`bases.${profile.employment_basis}`) : none,
            },
            {
              term: t('form.jobNature'),
              description: profile.job_nature ? t(`jobNatures.${profile.job_nature}`) : none,
            },
            {
              term: t('form.location'),
              description: profile.working_location ? t(`locations.${profile.working_location}`) : none,
            },
            { term: t('form.jobGrade'), description: profile.job_grade?.name ?? none },
            {
              term: t('form.reportingTo'),
              description: profile.supervisor ? profile.supervisor.full_name : none,
            },
            ...(profile.employment_type === 'employee'
              ? [
                  { term: t('form.department'), description: assignment?.department?.name ?? none },
                  { term: t('form.designation'), description: assignment?.designation?.name ?? none },
                ]
              : [
                  { term: t('form.section'), description: assignment?.section?.name ?? none },
                  { term: t('assignments.activity'), description: assignment?.activity_type?.name ?? none },
                ]),
            {
              term: t('form.probationEnd'),
              description: profile.probation_end_date ? format.date(profile.probation_end_date) : none,
            },
            {
              term: t('form.confirmationDate'),
              description: profile.confirmation_date ? format.date(profile.confirmation_date) : none,
            },
          ]}
        />
      )}
    </Card>
  );
}
