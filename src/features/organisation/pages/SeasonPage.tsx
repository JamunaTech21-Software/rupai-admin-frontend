import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  Input,
  PageHeader,
  Select,
  Stack,
  StatCard,
  toast,
} from '@/ui';

import {
  useCreateSeason,
  useDeleteSeason,
  useSeason,
  useSeasonTransition,
  useUpdateSeason,
} from '../api/calendar';
import { useAllEstates } from '../api/hierarchy';
import { NODE_CODE, type Season } from '../api/schemas';
import { seasonTone } from '../calendarTones';

/** Calendars → Seasons → one season (or a new one). */
export function SeasonPage() {
  const { id } = useParams();
  if (id === undefined) return <SeasonEditor season={null} />;
  return <ExistingSeason id={id} />;
}

function ExistingSeason({ id }: { readonly id: string }) {
  const query = useSeason(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version: after a save, a state change or a conflict reload the form shows what is stored.
  return <SeasonEditor key={`${query.data.id}-${String(query.data.version)}`} season={query.data} />;
}

const NO_SEASON = { id: '', version: 0, name: '' } as Season;

function SeasonEditor({ season }: { readonly season: Season | null }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const navigate = useNavigate();
  const canSave = usePermission(season ? 'season.edit' : 'season.create');
  const canChangeState = usePermission('season.edit');
  const canDelete = usePermission('season.delete');
  const estates = useAllEstates();
  const create = useCreateSeason();
  const update = useUpdateSeason(season ?? NO_SEASON);
  const transition = useSeasonTransition(season ?? NO_SEASON);
  const remove = useDeleteSeason(season ?? NO_SEASON);
  const [dialog, setDialog] = useState<'activate' | 'close' | 'delete' | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  // Planned: everything. Active: name and end date only. Closed: nothing.
  const state = season?.state ?? 'planned';
  const canEdit = canSave && state !== 'closed';
  const fixed = !canEdit || state === 'active';

  const required = (field: string) => t('validation.required', { field: field.toLowerCase() });
  const schema = z
    .object({
      estate_id: z
        .string()
        .nullable()
        .refine(
          (value) => value !== null,
          t('validation.choose', { field: t('season.estate').toLowerCase() }),
        ),
      code: z.string().trim().regex(NODE_CODE, t('validation.codeFormat')),
      name: z
        .string()
        .trim()
        .min(1, required(t('season.name')))
        .max(150),
      start_date: z
        .string()
        .nullable()
        .refine((value) => value !== null, required(t('season.startDate'))),
      end_date: z
        .string()
        .nullable()
        .refine((value) => value !== null, required(t('season.endDate'))),
    })
    .refine((v) => !v.start_date || !v.end_date || v.end_date > v.start_date, {
      path: ['end_date'],
      message: t('season.endAfterStart'),
    });
  const form = useZodForm(schema, {
    defaultValues: {
      estate_id: season?.estate_id ?? null,
      code: season?.code ?? '',
      name: season?.name ?? '',
      start_date: season?.start_date ?? null,
      end_date: season?.end_date ?? null,
    },
  });
  const bind = {
    estate_id: useFormField(form.control, 'estate_id'),
    code: useFormField(form.control, 'code'),
    name: useFormField(form.control, 'name'),
    start_date: useFormField(form.control, 'start_date'),
    end_date: useFormField(form.control, 'end_date'),
  };

  const submit = form.handleSubmit(async (values) => {
    if (!values.estate_id || !values.start_date || !values.end_date) return;
    const input = {
      code: values.code.trim(),
      name: values.name.trim(),
      start_date: values.start_date,
      end_date: values.end_date,
    };
    try {
      if (season) {
        await update.mutateAsync(input);
        toast.success(t('season.saved'));
        void navigate('/seasons');
      } else {
        const created = await create.mutateAsync({ ...input, estate_id: values.estate_id });
        toast.success(t('season.created', { name: created.name }));
        void navigate('/seasons');
      }
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      // An overlap comes back on start_date, naming the other season: shown next to the dates.
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setDialog(null);
      if (errorBehaviour(error) !== 'conflict') setRefusal(error);
    }
  }

  const name = season?.name ?? '';
  const title = season ? season.name : t('season.newTitle');
  const estate = estates.data?.find((e) => e.id === season?.estate_id);
  const estateLabel = estate ? estate.code : estates.isPending ? '…' : `#${season?.estate_id ?? ''}`;

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        {...(season
          ? { status: { tone: seasonTone(season.state), label: t(`seasonState.${season.state}`) } }
          : {})}
        description={season ? season.code : t('season.newIntro')}
        breadcrumbs={[{ label: t('season.backToList'), href: '/seasons' }, { label: title }]}
        actions={
          season ? (
            <>
              {canChangeState && season.state === 'planned' ? (
                <Button
                  onPress={() => {
                    setDialog('activate');
                  }}
                >
                  {t('season.activate')}
                </Button>
              ) : null}
              {canChangeState && season.state === 'active' ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setDialog('close');
                  }}
                >
                  {t('season.close')}
                </Button>
              ) : null}
              {canDelete && season.state === 'planned' ? (
                <Button
                  variant="danger"
                  iconStart="trash"
                  onPress={() => {
                    setDialog('delete');
                  }}
                >
                  {t('actions.delete')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {season ? (
        <section aria-label={t('season.summary')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('season.estate')} value={estateLabel} />
            <StatCard label={t('season.startDate')} value={format.date(season.start_date)} />
            <StatCard label={t('season.endDate')} value={format.date(season.end_date)} />
            {season.closed_at ? (
              <StatCard label={t('season.closedOn')} value={format.date(season.closed_at)} />
            ) : (
              <StatCard label={t('season.state')} value={t(`seasonState.${season.state}`)} />
            )}
          </div>
        </section>
      ) : null}
      {!canSave ? <PermissionNotice /> : null}
      {canSave && state === 'active' ? <Alert tone="info">{t('season.activeNotice')}</Alert> : null}
      {state === 'closed' ? <Alert tone="info">{t('season.closedNotice')}</Alert> : null}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Card title={t('season.details')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label={t('season.estate')}
              isRequired
              // The estate of a season never changes.
              isDisabled={season !== null || !canEdit}
              placeholder={t('season.chooseEstate')}
              className="md:col-span-2"
              value={bind.estate_id.value}
              options={(estates.data ?? [])
                .filter((e) => e.status === 'active' || e.id === season?.estate_id)
                .map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }))}
              onChange={bind.estate_id.onChange}
              {...(bind.estate_id.error ? { error: bind.estate_id.error } : {})}
            />
            <Input label={t('season.code')} isRequired autoComplete="off" {...bind.code} isReadOnly={fixed} />
            <Input
              label={t('season.name')}
              isRequired
              autoComplete="off"
              {...bind.name}
              isReadOnly={!canEdit}
            />
            <DatePicker
              label={t('season.startDate')}
              isRequired
              isReadOnly={fixed}
              value={bind.start_date.value}
              onChange={bind.start_date.onChange}
              {...(bind.start_date.error ? { error: bind.start_date.error } : {})}
            />
            <DatePicker
              label={t('season.endDate')}
              isRequired
              isReadOnly={!canEdit}
              value={bind.end_date.value}
              onChange={bind.end_date.onChange}
              {...(bind.end_date.error ? { error: bind.end_date.error } : {})}
            />
          </div>
        </Card>
        {canEdit ? (
          <div className="flex justify-end">
            <Button
              type="submit"
              isPending={create.isPending || update.isPending}
              className="w-full sm:w-auto"
            >
              {season ? t('actions.save') : t('season.create')}
            </Button>
          </div>
        ) : null}
      </form>
      <ConfirmDialog
        isOpen={dialog === 'activate'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('season.activateTitle', { name })}
        consequence={t('season.activateBody')}
        confirmLabel={t('season.activate')}
        onConfirm={() =>
          run(async () => {
            await transition.mutateAsync('activate');
            toast.success(t('season.activated', { name }));
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'close'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone="danger"
        title={t('season.closeTitle', { name })}
        consequence={t('season.closeBody')}
        confirmLabel={t('season.close')}
        onConfirm={() =>
          run(async () => {
            await transition.mutateAsync('close');
            toast.success(t('season.closed', { name }));
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone="danger"
        title={t('season.deleteTitle', { name })}
        consequence={t('season.deleteBody')}
        confirmLabel={t('actions.delete')}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            toast.success(t('season.deleted', { name }));
            void navigate('/seasons', { replace: true });
          })
        }
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { SeasonPage as Component };
