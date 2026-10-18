import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  Card,
  type DataColumn,
  DataTable,
  EmptyState,
  FileUpload,
  PageHeader,
  Select,
  Stack,
  type UploadFile,
} from '@/ui';

import {
  IMPORT_ACCEPT,
  IMPORT_MAX_BYTES,
  type ImportType,
  useImportTypes,
  useUploadImport,
} from '../api/imports';
import { DownloadButton } from '../components/DownloadButton';

/** The columns a file of this type takes: what each is, whether it is needed, and an example. */
function ColumnsTable({ type }: { readonly type: ImportType }) {
  const { t } = useTranslation('imports');
  const columns: DataColumn<ImportType['columns'][number]>[] = [
    {
      id: 'name',
      header: t('columns.name'),
      cell: (column) => <span className="font-medium">{column.name}</span>,
    },
    {
      id: 'required',
      header: t('columns.required'),
      cell: (column) => (column.required ? t('columns.yes') : t('columns.optional')),
    },
    { id: 'description', header: t('columns.description'), cell: (column) => column.description },
    { id: 'example', header: t('columns.example'), cell: (column) => <code>{column.example}</code> },
  ];
  return (
    <DataTable
      isPlain
      label={t('columns.title', { label: type.label })}
      columns={columns}
      rows={type.columns}
      getRowId={(column) => column.name}
      getRowLabel={(column) => column.name}
    />
  );
}

/**
 * Import from a file (P1.17), step 1 and 2: choose what is being imported, take the template (its Data sheet and
 * Instructions sheet say what each column is), fill it in and upload it. The upload becomes a batch the server
 * validates; the wizard continues on the batch's own page, whose address survives a reload. Nothing is saved yet.
 */
export function ImportNewPage() {
  const { t } = useTranslation('imports');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const types = useImportTypes();
  const chosen = params.get('type') ?? '';
  const type = types.data?.find((candidate) => candidate.key === chosen);
  const upload = useUploadImport(chosen);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [refusal, setRefusal] = useState<unknown>(null);

  if (types.isPending) return <PageLoading />;
  if (types.isError) return <PageError error={types.error} onRetry={() => void types.refetch()} />;

  async function send() {
    const file = files[0]?.file;
    if (!file) {
      setError(t('upload.required'));
      return;
    }
    try {
      const batch = await upload.mutateAsync(file);
      void navigate(`/imports/${batch.id}`);
    } catch (failure) {
      if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
        setError(failure.fieldErrors[0]?.message ?? failure.message);
        return;
      }
      setRefusal(failure);
    }
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title={type ? t('new.titleFor', { label: type.label }) : t('new.title')}
        description={t('new.description')}
        breadcrumbs={[{ label: t('title'), href: '/imports' }, { label: t('new.title') }]}
      />
      {types.data.length === 0 ? (
        <EmptyState kind="new" title={t('new.noTypesTitle')} description={t('new.noTypesBody')} />
      ) : (
        <>
          <Card title={t('new.step1')} headingLevel={2}>
            <div className="flex flex-col gap-4">
              <Select
                label={t('new.type')}
                className="max-w-md"
                placeholder={t('new.chooseType')}
                value={type ? type.key : null}
                options={types.data.map((candidate) => ({ id: candidate.key, label: candidate.label }))}
                onChange={(value) => {
                  setParams(value ? { type: value } : {});
                  setFiles([]);
                  setError(undefined);
                }}
              />
              {type ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{t('new.template')}</span>
                    <DownloadButton
                      path={`/imports/templates/${type.key}`}
                      format="xlsx"
                      fallbackName={type.key}
                      label={t('new.template')}
                      onRefused={setRefusal}
                    />
                    <DownloadButton
                      path={`/imports/templates/${type.key}`}
                      format="csv"
                      fallbackName={type.key}
                      label={t('new.template')}
                      onRefused={setRefusal}
                    />
                  </div>
                  <p className="text-sm text-fg-muted">{t('new.templateHint', { count: type.max_rows })}</p>
                  <ColumnsTable type={type} />
                </>
              ) : null}
            </div>
          </Card>
          {type ? (
            <Card title={t('new.step2')} headingLevel={2}>
              <div className="flex flex-col gap-4">
                <FileUpload
                  label={t('upload.label')}
                  hint={t('upload.hint')}
                  accept={IMPORT_ACCEPT}
                  maxSizeBytes={IMPORT_MAX_BYTES}
                  files={files}
                  onFilesChange={(next) => {
                    setFiles(next.slice(-1));
                    setError(undefined);
                  }}
                  {...(error ? { error } : {})}
                />
                <Alert tone="info" title={t('upload.safeTitle')}>
                  {t('upload.safeBody')}
                </Alert>
                <div>
                  <Button
                    isPending={upload.isPending}
                    onPress={() => {
                      void send();
                    }}
                  >
                    {t('upload.button')}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      )}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { ImportNewPage as Component };
