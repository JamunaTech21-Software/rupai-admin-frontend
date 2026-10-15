import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { NotFoundState, PageError, PageLoading, RefusalDialog } from '@/features/system';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  DatePicker,
  Input,
  PageHeader,
  Select,
  Stack,
  Textarea,
  toast,
} from '@/ui';

import {
  type DocumentType,
  useCreateWorkflow,
  useDocumentTypeList,
  useEstateChoices,
  useRoleChoices,
  useSupersedeWorkflow,
  useUpdateWorkflow,
  useWorkflow,
  type Workflow,
} from '../api/workflows';
import { AddConditionButton, ConditionEditor } from '../components/ConditionEditor';
import { blankCondition, blankDraft, fromWorkflow, toBody, type WorkflowDraft } from '../components/draft';
import { StepsEditor } from '../components/StepsEditor';
import { problemsOf } from '../components/validate';

type Mode = 'new' | 'edit' | 'version';
const ALL_ESTATES = 'all';
const STUB = { id: '', version: 0, name: '' } as const;

function Editor({
  mode,
  source,
  documentTypes,
}: {
  readonly mode: Mode;
  readonly source: Workflow | null;
  readonly documentTypes: readonly DocumentType[];
}) {
  const { t } = useTranslation('workflows');
  const navigate = useNavigate();
  const estates = useEstateChoices();
  const roles = useRoleChoices();
  const create = useCreateWorkflow();
  const update = useUpdateWorkflow(source ?? STUB);
  const supersede = useSupersedeWorkflow(source ?? STUB);
  const [draft, setDraft] = useState<WorkflowDraft>(() => (source ? fromWorkflow(source) : blankDraft()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<unknown>(null);

  const documentType = documentTypes.find((type) => type.key === draft.documentType);
  const isPending = create.isPending || update.isPending || supersede.isPending;
  const patch = (changes: Partial<WorkflowDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  const clear = (...paths: string[]) => {
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([path]) => !paths.includes(path))),
    );
  };

  async function save() {
    const problems = problemsOf(draft, mode === 'version');
    setErrors(Object.fromEntries(Object.entries(problems).map(([path, key]) => [path, t(`editor.${key}`)])));
    if (Object.keys(problems).length > 0) return;
    const body = toBody(draft);
    try {
      let saved: Workflow;
      if (mode === 'new') saved = await create.mutateAsync(body);
      else if (mode === 'edit') saved = await update.mutateAsync(body);
      else
        saved = await supersede.mutateAsync({
          name: body.name,
          effective_from: body.effective_from,
          effective_to: body.effective_to,
          conditions: body.conditions,
          notes: body.notes,
          steps: body.steps,
        });
      toast.success(
        t(mode === 'new' ? 'editor.created' : mode === 'edit' ? 'editor.saved' : 'editor.versionStarted'),
      );
      void navigate(`/admin/workflows/${saved.id}`);
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const placed: Record<string, string> = {};
        let rest = false;
        for (const detail of error.fieldErrors) {
          if (detail.field)
            placed[detail.field] = placed[detail.field]
              ? `${placed[detail.field] ?? ''} ${detail.message}`
              : detail.message;
          else rest = true;
        }
        if (Object.keys(placed).length > 0) {
          setErrors(placed);
          if (!rest) return;
        }
      }
      setRefusal(error);
    }
  }

  const title = t(
    mode === 'new' ? 'editor.titleNew' : mode === 'edit' ? 'editor.titleEdit' : 'editor.titleVersion',
  );
  const back = source ? `/admin/workflows/${source.id}` : '/admin/workflows';
  // Messages on the steps and conditions that no control shows on its own: a summary, so none is missed.
  const unplaced = Object.entries(errors).filter(
    ([path]) =>
      !['code', 'name', 'document_type', 'estate_id', 'effective_from', 'effective_to', 'notes'].includes(
        path,
      ) &&
      !path.startsWith('steps.') &&
      !path.startsWith('conditions.'),
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        description={source ? t('editor.subtitle', { name: source.name }) : t('editor.intro')}
        breadcrumbs={[
          { label: t('title'), href: '/admin/workflows' },
          ...(source ? [{ label: source.name, href: back }] : []),
          { label: title },
        ]}
      />
      {unplaced.length > 0 ? (
        <Alert tone="danger" title={t('editor.problems')}>
          {unplaced.map(([path, message]) => (
            <span key={path} className="block">
              {message}
            </span>
          ))}
        </Alert>
      ) : null}
      <Card title={t('editor.details')} headingLevel={2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('editor.code')}
            hint={t('editor.codeHint')}
            isRequired
            isDisabled={mode === 'version'}
            value={draft.code}
            maxLength={30}
            onChange={(value) => {
              patch({ code: value });
              clear('code');
            }}
            {...(errors.code ? { error: errors.code } : {})}
          />
          <Input
            label={t('editor.name')}
            isRequired
            value={draft.name}
            maxLength={150}
            onChange={(value) => {
              patch({ name: value });
              clear('name');
            }}
            {...(errors.name ? { error: errors.name } : {})}
          />
          <Select
            label={t('editor.documentType')}
            isRequired
            isDisabled={mode === 'version'}
            value={draft.documentType === '' ? null : draft.documentType}
            options={documentTypes.map((type) => ({ id: type.key, label: type.label }))}
            onChange={(value) => {
              // The fields differ by type: conditions written for another type no longer apply.
              patch({
                documentType: value ?? '',
                conditions: [],
                steps: draft.steps.map((s) => ({ ...s, condition: null, allowSelf: false })),
              });
              clear('document_type');
            }}
            {...(errors.document_type ? { error: errors.document_type } : {})}
          />
          <Select
            label={t('editor.estate')}
            hint={t('editor.estateHint')}
            isDisabled={mode === 'version'}
            value={draft.estateId === '' ? ALL_ESTATES : draft.estateId}
            options={[
              { id: ALL_ESTATES, label: t('scopeAll') },
              ...(estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            ]}
            onChange={(value) => {
              patch({ estateId: value === null || value === ALL_ESTATES ? '' : value });
            }}
          />
          <DatePicker
            label={t('editor.effectiveFrom')}
            isRequired
            value={draft.effectiveFrom}
            onChange={(value) => {
              patch({ effectiveFrom: value });
              clear('effective_from', 'effective_to');
            }}
            {...(errors.effective_from ? { error: errors.effective_from } : {})}
          />
          <DatePicker
            label={t('editor.effectiveTo')}
            hint={t('editor.effectiveToHint')}
            value={draft.effectiveTo}
            onChange={(value) => {
              patch({ effectiveTo: value });
              clear('effective_to');
            }}
            {...(errors.effective_to ? { error: errors.effective_to } : {})}
          />
          <div className="sm:col-span-2">
            <Textarea
              label={t('editor.notes')}
              value={draft.notes}
              maxLength={500}
              rows={3}
              onChange={(value) => {
                patch({ notes: value });
              }}
              {...(errors.notes ? { error: errors.notes } : {})}
            />
          </div>
        </div>
      </Card>
      <Card title={t('editor.conditions')} description={t('editor.conditionsIntro')} headingLevel={2}>
        <div className="flex flex-col gap-3">
          {draft.conditions.map((condition, index) => (
            <ConditionEditor
              key={String(index)}
              condition={condition}
              fields={documentType?.fields ?? []}
              label={t('editor.conditionName', { number: index + 1 })}
              error={errors[`conditions.${String(index)}`]}
              onChange={(next) => {
                patch({ conditions: draft.conditions.map((c, at) => (at === index ? next : c)) });
                clear(`conditions.${String(index)}`);
              }}
              onRemove={() => {
                patch({ conditions: draft.conditions.filter((_, at) => at !== index) });
                setErrors({});
              }}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <AddConditionButton
              label={t('editor.addCondition')}
              onPress={() => {
                patch({ conditions: [...draft.conditions, blankCondition()] });
              }}
            />
            {documentType ? null : <span className="text-sm text-fg-muted">{t('editor.pickTypeFirst')}</span>}
          </div>
        </div>
      </Card>
      <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="steps-heading" className="text-lg font-semibold text-heading">
            {t('editor.steps')}
          </h2>
          <p className="text-fg-muted">{t('editor.stepsIntro')}</p>
        </div>
        <StepsEditor
          steps={draft.steps}
          documentType={documentType}
          roles={roles.data ?? []}
          errors={errors}
          onChange={(steps) => {
            patch({ steps });
            setErrors((current) =>
              Object.fromEntries(Object.entries(current).filter(([path]) => !path.startsWith('steps.'))),
            );
          }}
        />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          isPending={isPending}
          onPress={() => {
            void save();
          }}
        >
          {t(mode === 'version' ? 'editor.startVersion' : 'editor.save')}
        </Button>
        <ButtonLink href={back} variant="secondary">
          {t('editor.cancel')}
        </ButtonLink>
      </div>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

/**
 * Create a workflow, edit a draft, or start the next version of an active one (P1.13). The saved workflow opens on
 * its own page, where it is submitted for approval. Written as text throughout; the server checks the whole
 * definition and names each problem on the field or step it concerns.
 */
export function WorkflowEditorPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const mode: Mode = id === undefined ? 'new' : pathname.endsWith('/new-version') ? 'version' : 'edit';
  const types = useDocumentTypeList();
  const query = useWorkflow(id);

  if (mode !== 'new' && query.isPending) return <PageLoading />;
  if (mode !== 'new' && query.isError)
    return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  if (types.isPending) return <PageLoading />;
  if (types.isError) return <PageError error={types.error} onRetry={() => void types.refetch()} />;
  const source = mode === 'new' ? null : (query.data ?? null);
  // Only a draft is edited and only an active workflow gets a next version.
  if (
    source &&
    ((mode === 'edit' && source.state !== 'draft') || (mode === 'version' && source.state !== 'active'))
  )
    return <NotFoundState />;
  return <Editor key={source?.id ?? 'new'} mode={mode} source={source} documentTypes={types.data} />;
}

export { WorkflowEditorPage as Component };
