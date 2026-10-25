import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useAllEstates, useDivisions, useEstateSections } from '@/features/organisation';
import { PermissionNotice } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, Card, Input, Select, Textarea, toast } from '@/ui';

import { useEstateProfiles } from '../api/profiles';
import { TEAM_TYPES, type Team, type TeamInput, useCreateTeam, useUpdateTeam } from '../api/teams';

const NONE = 'none';
const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const blank = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Add or change a team: its estate (fixed once made), code, name, kind, the supervisor (sardar), where it works
 * (division, section) and a note. The division follows the section when only the section is chosen.
 */
export function TeamForm({
  team,
  onRefused,
}: {
  readonly team: Team | null;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const isNew = team === null;
  const canEdit = usePermission(isNew ? 'team.create' : 'team.edit') && team?.status !== 'inactive';
  const create = useCreateTeam();
  const update = useUpdateTeam(team ?? { id: '', version: 0, name: '' });
  const estates = useAllEstates();

  const schema = z
    .object({
      estate_id: z.string().nullable(),
      code: z
        .string()
        .trim()
        .min(1, t('validation.teamCode'))
        .max(20, t('validation.tooLong', { max: 20 })),
      name: z
        .string()
        .trim()
        .min(1, t('validation.teamName'))
        .max(150, t('validation.tooLong', { max: 150 })),
      team_type: z.enum(TEAM_TYPES),
      supervisor_profile_id: z.string().nullable(),
      division_id: z.string().nullable(),
      section_id: z.string().nullable(),
      description: z
        .string()
        .trim()
        .max(500, t('validation.tooLong', { max: 500 })),
    })
    .refine((v) => v.code === '' || CODE.test(v.code), {
      path: ['code'],
      message: t('validation.teamCodeFormat'),
    })
    .refine((v) => !isNew || v.estate_id !== null, { path: ['estate_id'], message: t('validation.estate') });

  const form = useZodForm(schema, {
    defaultValues: {
      estate_id: team?.estate_id ?? null,
      code: team?.code ?? '',
      name: team?.name ?? '',
      team_type: team?.team_type ?? 'plucking',
      supervisor_profile_id: team?.supervisor_profile_id ?? null,
      division_id: team?.division_id ?? null,
      section_id: team?.section_id ?? null,
      description: team?.description ?? '',
    },
  });
  const c = form.control;
  const bind = {
    estate_id: useFormField(c, 'estate_id'),
    code: useFormField(c, 'code'),
    name: useFormField(c, 'name'),
    team_type: useFormField(c, 'team_type'),
    supervisor_profile_id: useFormField(c, 'supervisor_profile_id'),
    division_id: useFormField(c, 'division_id'),
    section_id: useFormField(c, 'section_id'),
    description: useFormField(c, 'description'),
  };
  const readOnly = { isReadOnly: !canEdit };
  const estateId = team?.estate_id ?? bind.estate_id.value ?? '';
  const divisions = useDivisions(estateId);
  const sections = useEstateSections(estateId);
  const profiles = useEstateProfiles(estateId === '' ? null : estateId);
  const supervisors = (profiles.data ?? []).map((p) => ({
    id: p.id,
    label: `${p.person.full_name} (${p.profile_number})`,
  }));
  if (team?.supervisor && !supervisors.some((option) => option.id === team.supervisor?.id))
    supervisors.push({
      id: team.supervisor.id,
      label: `${team.supervisor.full_name} (${team.supervisor.profile_number})`,
    });
  const sectionOptions = sections.sections.filter(
    (section) => bind.division_id.value === null || section.division_id === bind.division_id.value,
  );

  const submit = form.handleSubmit(async (v) => {
    const input: TeamInput = {
      code: v.code.trim(),
      name: v.name.trim(),
      team_type: v.team_type,
      supervisor_profile_id: v.supervisor_profile_id,
      division_id: v.division_id,
      section_id: v.section_id,
      description: blank(v.description),
    };
    try {
      if (team === null) {
        const made = await create.mutateAsync({ ...input, estate_id: v.estate_id ?? '' });
        toast.success(t('team.created', { name: made.name }));
        void navigate('/workforce/teams');
      } else {
        await update.mutateAsync(input);
        toast.success(t('team.saved'));
        void navigate('/workforce/teams');
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
    }
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {!canEdit && team?.status !== 'inactive' ? <PermissionNotice /> : null}
      <Card title={t('team.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {team ? (
            <Input label={t('team.estate')} value={`${team.estate.code} · ${team.estate.name}`} isReadOnly />
          ) : (
            <Select
              label={t('team.estate')}
              placeholder={t('form.select')}
              isRequired
              value={bind.estate_id.value ?? NONE}
              options={(estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              }))}
              onChange={(next) => {
                bind.estate_id.onChange(next === null || next === NONE ? null : next);
                bind.supervisor_profile_id.onChange(null);
                bind.division_id.onChange(null);
                bind.section_id.onChange(null);
              }}
              {...(bind.estate_id.error ? { error: bind.estate_id.error } : {})}
            />
          )}
          <Input
            label={t('team.code')}
            placeholder={t('team.placeholders.code')}
            isRequired
            {...bind.code}
            {...readOnly}
          />
          <Input
            label={t('team.name')}
            placeholder={t('team.placeholders.name')}
            isRequired
            {...bind.name}
            {...readOnly}
          />
          <Select
            label={t('team.type')}
            isDisabled={!canEdit}
            value={bind.team_type.value}
            options={TEAM_TYPES.map((value) => ({ id: value, label: t(`teamTypes.${value}`) }))}
            onChange={(next) => {
              const found = TEAM_TYPES.find((value) => value === next);
              if (found) bind.team_type.onChange(found);
            }}
          />
          <Select
            label={t('team.supervisor')}
            placeholder={t('form.select')}
            isDisabled={!canEdit || estateId === ''}
            value={bind.supervisor_profile_id.value ?? NONE}
            options={[{ id: NONE, label: t('team.noSupervisor') }, ...supervisors]}
            onChange={(next) => {
              bind.supervisor_profile_id.onChange(next === null || next === NONE ? null : next);
            }}
          />
          <Select
            label={t('team.division')}
            placeholder={t('form.select')}
            isDisabled={!canEdit || estateId === ''}
            value={bind.division_id.value ?? NONE}
            options={[
              { id: NONE, label: t('team.anyDivision') },
              ...(divisions.data ?? []).map((d) => ({ id: d.id, label: d.name })),
            ]}
            onChange={(next) => {
              bind.division_id.onChange(next === null || next === NONE ? null : next);
              bind.section_id.onChange(null);
            }}
          />
          <Select
            label={t('team.section')}
            placeholder={t('form.select')}
            isDisabled={!canEdit || estateId === ''}
            value={bind.section_id.value ?? NONE}
            options={[
              { id: NONE, label: t('team.anySection') },
              ...sectionOptions.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
            ]}
            onChange={(next) => {
              bind.section_id.onChange(next === null || next === NONE ? null : next);
            }}
          />
          <Textarea
            label={t('team.description')}
            placeholder={t('team.placeholders.description')}
            rows={2}
            maxLength={500}
            className="sm:col-span-2 xl:col-span-3"
            {...bind.description}
            {...readOnly}
          />
        </div>
      </Card>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" isPending={create.isPending || update.isPending} className="w-full sm:w-auto">
            {isNew ? t('team.create') : t('team.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
