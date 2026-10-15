import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Document attachments (P1.12). Any record with an owner entry on the backend (estate, field, factory,
 * warehouse, party) can hold documents: `{owner}/{id}/documents` lists and adds them, `/documents/{id}` works on
 * one. Changes send If-Match with the record version read; replacing keeps the old file as an earlier version.
 */

export const DOCUMENT_STATUSES = ['active', 'superseded', 'archived'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** The owners a document can belong to, by the path of their API and the permission module that decides access. */
export const DOCUMENT_OWNERS = [
  { type: 'estate', path: '/estates', module: 'estate' },
  { type: 'field', path: '/fields', module: 'field' },
  { type: 'factory', path: '/factories', module: 'factory' },
  { type: 'warehouse', path: '/warehouses', module: 'warehouse' },
  { type: 'party', path: '/parties', module: 'land' },
] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNERS)[number]['type'];

/** What the picker accepts, as the backend does (pdf, jpg, png, webp, docx, xlsx), up to its default 10 MB. */
export const DOCUMENT_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  '.docx',
  '.xlsx',
] as const;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const DocumentSchema = z.looseObject({
  id: z.string(),
  owner_type: z.string(),
  owner_id: z.string(),
  document_type_id: z.string(),
  document_type: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  title: z.string().nullable(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.number().int(),
  /** The document's own version (1, 2, 3 …): the one users see. `version` is the record's, for If-Match. */
  version_number: z.number().int(),
  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  /** Negative once expired; null without an expiry date. */
  days_to_expiry: z.number().int().nullable(),
  is_current: z.boolean(),
  status: z.enum(DOCUMENT_STATUSES),
  uploaded_by_name: z.string(),
  version: z.number().int(),
  created_at: z.string(),
});
export type DocumentRecord = z.infer<typeof DocumentSchema>;

export const ExpiringDocumentSchema = DocumentSchema.extend({
  /** The owner as the user knows it, e.g. "DEMO-F1 · Demo factory". */
  owner_label: z.string(),
});
export type ExpiringDocument = z.infer<typeof ExpiringDocumentSchema>;

export const documentKeys = createQueryKeys('documents');

export interface DocumentOwner {
  /** The owner's API path: `/factories`. */
  readonly path: string;
  readonly id: string;
}

/** An owner's documents: the current version of each, or every version with `history`. */
export function useOwnerDocuments(owner: DocumentOwner, history: boolean) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: documentKeys.list(`${owner.path}/${owner.id}:${history ? 'history' : 'current'}`),
    queryFn: async ({ signal }) =>
      (
        await api.get(`${owner.path}/${owner.id}/documents`, {
          query: history ? { history: 'true' } : {},
          schema: z.array(DocumentSchema),
          signal,
        })
      ).data,
  });
}

/** One document's versions, newest first. */
export function useDocumentVersions(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: documentKeys.sub(id, 'versions'),
    queryFn: async ({ signal }) =>
      (await api.get(`/documents/${id}/versions`, { schema: z.array(DocumentSchema), signal })).data,
  });
}

export interface DocumentDetails {
  readonly title: string;
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
}

/** The text fields of an upload or a replacement; a field left out is not sent, so a replacement keeps it. */
function formOf(file: File, details: DocumentDetails, documentTypeId?: string): FormData {
  const form = new FormData();
  if (documentTypeId) form.append('document_type_id', documentTypeId);
  if (details.title !== '') form.append('title', details.title);
  if (details.issueDate) form.append('issue_date', details.issueDate);
  if (details.expiryDate) form.append('expiry_date', details.expiryDate);
  form.append('file', file);
  return form;
}

/** A new document (multipart). Every upload is a new document, even of the same type. */
export function useUploadDocument(owner: DocumentOwner) {
  return useApiMutation({
    mutationFn: async (input: { file: File; documentTypeId: string } & DocumentDetails) =>
      (
        await api.post(
          `${owner.path}/${owner.id}/documents`,
          formOf(input.file, input, input.documentTypeId),
          {
            schema: DocumentSchema,
          },
        )
      ).data,
    invalidates: () => [documentKeys.all],
  });
}

/** A renewal: a new file for the same document. It is a new record (new id); the old one becomes superseded. */
export function useReplaceDocument(doc: Pick<DocumentRecord, 'id' | 'version' | 'title' | 'file_name'>) {
  return useApiMutation({
    mutationFn: async (input: { file: File } & DocumentDetails) =>
      (
        await api.post(`/documents/${doc.id}/replace`, formOf(input.file, input), {
          schema: DocumentSchema,
          versioned: true,
          ifMatch: doc.version,
        })
      ).data,
    invalidates: () => [documentKeys.all],
    conflictSubject: () => doc.title ?? doc.file_name,
  });
}

/** Correct the title or dates of the current version, without a new file. null clears a value. */
export function useUpdateDocument(doc: Pick<DocumentRecord, 'id' | 'version' | 'title' | 'file_name'>) {
  return useApiMutation({
    mutationFn: async (input: DocumentDetails) =>
      (
        await api.patch(
          `/documents/${doc.id}`,
          {
            title: input.title === '' ? null : input.title,
            issue_date: input.issueDate,
            expiry_date: input.expiryDate,
          },
          { schema: DocumentSchema, ifMatch: doc.version },
        )
      ).data,
    invalidates: () => [documentKeys.all],
    conflictSubject: () => doc.title ?? doc.file_name,
  });
}

/** Take a document out of the lists (it is archived, never erased). */
export function useRemoveDocument() {
  return useApiMutation({
    mutationFn: async (doc: Pick<DocumentRecord, 'id'>) => {
      await api.delete(`/documents/${doc.id}`);
    },
    invalidates: () => [documentKeys.all],
  });
}

const DownloadSchema = z.object({ url: z.string(), file_name: z.string() });

/** A link that works for a few minutes without a sign-in header: asked for at the click, never kept. */
export function useDownloadLink() {
  return useApiMutation({
    mutationFn: async (doc: Pick<DocumentRecord, 'id'>) =>
      (await api.get(`/documents/${doc.id}/download`, { schema: DownloadSchema })).data,
    invalidates: () => [],
  });
}

/** Documents about to expire (by default within 30 days, expired ones too), soonest first. */
export function useExpiringDocuments() {
  return usePagedList({
    keys: documentKeys,
    path: '/documents/expiring',
    row: ExpiringDocumentSchema,
    pageSize: 25,
  });
}
