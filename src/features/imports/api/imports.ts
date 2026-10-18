import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * The import framework (P1.17, P5 §7.6): one wizard for every kind of import. A file of a type is uploaded as a batch,
 * validated by a job, its errors are read and corrected, and the valid rows are committed by a second job. Nothing is
 * saved until commit. What may be done now is the server's answer (`can_commit`, `can_cancel`), never worked out
 * here. Someone else's batch is 404.
 */

export const importKeys = createQueryKeys('imports');

export const BATCH_STATES = [
  'validating',
  'validated',
  'rejected',
  'committing',
  'committed',
  'cancelled',
] as const;
export type BatchState = (typeof BATCH_STATES)[number];

export const ROW_STATES = ['valid', 'invalid', 'committed', 'failed'] as const;
export const FORMATS = ['xlsx', 'csv'] as const;
export type SheetFormat = (typeof FORMATS)[number];

/** The upload limit the API states (10 MB). */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_ACCEPT = ['.xlsx', '.csv'] as const;

const ImportTypeSchema = z.looseObject({
  key: z.string(),
  label: z.string(),
  permission: z.string(),
  max_rows: z.number().int(),
  columns: z.array(
    z.object({ name: z.string(), required: z.boolean(), description: z.string(), example: z.string() }),
  ),
});
export type ImportType = z.infer<typeof ImportTypeSchema>;

/** The job working on a batch: what is needed to follow it (the full job is at /jobs/{id}). */
const BatchJobSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  state: z.string(),
  progress: z.object({ done: z.number(), total: z.number().nullable() }),
  poll_after_seconds: z.number().nullable(),
});

export const BatchSchema = z.looseObject({
  id: z.string(),
  import_type: z.string(),
  label: z.string(),
  state: z.enum(BATCH_STATES),
  file_name: z.string(),
  file_format: z.enum(FORMATS),
  row_count: z.number().int(),
  valid_count: z.number().int(),
  error_count: z.number().int(),
  committed_count: z.number().int(),
  failed_count: z.number().int(),
  problems: z.array(z.object({ code: z.string(), message: z.string() })),
  can_commit: z.boolean(),
  can_cancel: z.boolean(),
  job: BatchJobSchema.nullable(),
  validate_job_id: z.string().nullable(),
  commit_job_id: z.string().nullable(),
  created_by: z.object({ id: z.string(), username: z.string() }),
  created_at: z.string(),
  validated_at: z.string().nullable(),
  committed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  version: z.number().int(),
});
export type Batch = z.infer<typeof BatchSchema>;

const ErrorLineSchema = z.looseObject({
  row_number: z.number().int(),
  column: z.string().nullable(),
  code: z.string(),
  message: z.string(),
});
export type ErrorLine = z.infer<typeof ErrorLineSchema>;

/** The kinds of file this user may import, with the columns each takes. */
export function useImportTypes() {
  return useQuery({
    ...cachePolicy('reference'),
    queryKey: [...importKeys.all, 'types'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/imports/types', { schema: z.array(ImportTypeSchema), signal })).data,
  });
}

/** Past and current imports, newest first, filtered from the URL (`filter[import_type]`, `filter[state]`). */
export function useImportsList() {
  return usePagedList({ keys: importKeys, path: '/imports', row: BatchSchema, pageSize: 25 });
}

/**
 * One batch, followed while a job works on it: asked again every `poll_after_seconds` while there is a job, and not
 * at all once the batch is at rest (validated, rejected, committed, cancelled).
 */
export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: importKeys.detail(id ?? ''),
    enabled: id !== undefined,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (await api.get(`/imports/${id ?? ''}`, { schema: BatchSchema, signal })).data,
    // After queryFn, so the data is typed here.
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      return job ? Math.max(job.poll_after_seconds ?? 2, 1) * 1000 : false;
    },
  });
}

/** The error report: one line per error, for the rows invalid at validation or failed at commit. */
export function useBatchErrors(id: string, enabled: boolean) {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: importKeys.sub(id, 'errors'),
    enabled,
    queryFn: async ({ signal }) =>
      (await api.get(`/imports/${id}/errors`, { schema: z.array(ErrorLineSchema), signal })).data,
  });
}

/** Upload the filled-in template (.xlsx or .csv): a new batch, being validated. */
export function useUploadImport(type: string) {
  return useApiMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post(`/imports/${type}`, form, { schema: BatchSchema })).data;
    },
    invalidates: () => [importKeys.lists()],
  });
}

/** Commit the valid rows (only the server's `can_commit` allows it). Answers at once; a job does the work. */
export function useCommitImport(batch: Pick<Batch, 'id'>) {
  return useApiMutation({
    mutationFn: async () =>
      (await api.post(`/imports/${batch.id}/commit`, undefined, { schema: BatchSchema })).data,
    invalidates: () => [importKeys.all],
  });
}

/** Cancel a batch (only the server's `can_cancel` allows it): nothing of it is saved. */
export function useCancelImport(batch: Pick<Batch, 'id'>) {
  return useApiMutation({
    mutationFn: async () =>
      (await api.post(`/imports/${batch.id}/cancel`, undefined, { schema: BatchSchema })).data,
    invalidates: () => [importKeys.all],
  });
}

/** Fetch a file the API builds (a template or the error report) and save it, named as the server named it. */
export async function saveFile(path: string, format: SheetFormat, fallbackName: string): Promise<void> {
  const { blob, fileName } = await api.download(path, { query: { format } });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName ?? `${fallbackName}.${format}`;
  anchor.rel = 'noopener';
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
