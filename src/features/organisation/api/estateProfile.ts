import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, useApiMutation } from '@/lib/query';

import { estateKeys } from './hierarchy';

/**
 * The estate profile's own data (R.2): the computed overview, the estate's key people (Estate Manager and
 * Assistant Manager, as contacts of the estate) and its photographs (documents of type Photograph). Changes send
 * If-Match with the version read and refresh the estate's queries.
 */

// ---- Overview -------------------------------------------------------------------------------------------

/** The figures of the overview that can be entered (R.2). */
export const FIGURES = [
  'tea_area',
  'non_tea_area',
  'division_count',
  'section_count',
  'field_count',
  'worker_count',
  'family_count',
] as const;
export type Figure = (typeof FIGURES)[number];

const Counts = z.object({ total: z.number().int(), active: z.number().int(), inactive: z.number().int() });

/** The figures under the Division & Section and Field / Block lists (R.3): always computed by the server. */
export const HierarchySummarySchema = z.object({
  divisions: Counts,
  sections: Counts,
  fields: Counts,
  /** Active fields per field type; every type is present. */
  field_types: z.record(z.string(), z.number().int()),
  division_area: z.string(),
  section_area: z.string(),
  /** Null when no section has an area. */
  average_section_area: z.string().nullable(),
  field_area: z.string(),
  planted_area: z.string(),
});
export type HierarchySummary = z.infer<typeof HierarchySummarySchema>;

export const EstateSummarySchema = z.object({
  estate_id: z.string(),
  /** The declared total land area; null while none is declared. Acres. */
  total_land_area: z.string().nullable(),
  tea_area: z.string(),
  non_tea_area: z.string().nullable(),
  field_area: z.string(),
  division_count: z.number().int(),
  section_count: z.number().int(),
  field_count: z.number().int(),
  factory_count: z.number().int(),
  worker_count: z.number().int(),
  family_count: z.number().int(),
  /** False until HR exists: workers and families are not known yet. */
  /** Where each figure above came from: what was entered, or what the records say. */
  source: z.partialRecord(z.enum(FIGURES), z.enum(['entered', 'computed'])),
  /** What the records say, always (workers and families are null until HR). */
  computed: z.partialRecord(z.enum(FIGURES), z.union([z.string(), z.number().int()]).nullable()),
  workforce_available: z.boolean(),
  hierarchy: HierarchySummarySchema,
  photo_count: z.number().int(),
});
export type EstateSummary = z.infer<typeof EstateSummarySchema>;

/** GET /estates/{id}/summary: computed by the server, never entered. */
export function useEstateSummary(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.sub(id, 'summary'),
    // A new estate has no id, and no overview yet.
    enabled: id !== '',
    queryFn: async ({ signal }) =>
      (await api.get(`/estates/${id}/summary`, { schema: EstateSummarySchema, signal })).data,
  });
}

// ---- Key people -----------------------------------------------------------------------------------------

export const KEY_PEOPLE = ['estate_manager', 'assistant_manager'] as const;
export type KeyPerson = (typeof KEY_PEOPLE)[number];

export const EstateContactSchema = z.looseObject({
  id: z.string(),
  contact_name: z.string(),
  designation: z.string().nullable(),
  contact_type: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  status: z.string(),
  version: z.number().int(),
});
export type EstateContact = z.infer<typeof EstateContactSchema>;

export interface KeyPersonInput {
  readonly contact_name: string;
  readonly designation: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

/** The estate's contacts; the profile shows the active Estate Manager and Assistant Manager. */
export function useEstateContacts(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.sub(id, 'contacts'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/estates/${id}/contacts`, {
          query: { per_page: 200 },
          schema: z.array(EstateContactSchema),
          signal,
        })
      ).data,
  });
}

/**
 * Saves one key person: creates the contact, or changes the existing one (PATCH with If-Match). Each is its own
 * request, after the estate itself, so the page saves everything from one Save.
 */
export function useSaveKeyPerson(estateId: string) {
  return useApiMutation({
    mutationFn: async ({
      role,
      existing,
      input,
    }: {
      readonly role: KeyPerson;
      readonly existing: EstateContact | null;
      readonly input: KeyPersonInput;
    }) =>
      existing
        ? (
            await api.patch(`/estates/${estateId}/contacts/${existing.id}`, input, {
              schema: EstateContactSchema,
              ifMatch: existing.version,
            })
          ).data
        : (
            await api.post(
              `/estates/${estateId}/contacts`,
              { ...input, contact_type: role },
              { schema: EstateContactSchema },
            )
          ).data,
    invalidates: () => [estateKeys.sub(estateId, 'contacts')],
    conflictSubject: ({ input }) => input.contact_name,
  });
}

/** Removes a key person the user cleared. */
export function useRemoveKeyPerson(estateId: string) {
  return useApiMutation({
    mutationFn: async (contact: EstateContact) => {
      await api.delete(`/estates/${estateId}/contacts/${contact.id}`);
    },
    invalidates: () => [estateKeys.sub(estateId, 'contacts')],
  });
}

// ---- Photographs ----------------------------------------------------------------------------------------

/** The document type photographs are filed under (GET /lookups/document_type, this code). */
export const PHOTOGRAPH = 'PHOTOGRAPH';
/** What the backend accepts for a picture. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
/** The server's default limit (UPLOAD_MAX_MB = 10). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const EstatePhotoSchema = z.looseObject({
  id: z.string(),
  title: z.string().nullable(),
  file_name: z.string(),
  mime_type: z.string(),
  document_type: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  version: z.number().int(),
});
export type EstatePhoto = z.infer<typeof EstatePhotoSchema>;

const DownloadSchema = z.object({ url: z.string(), expires_at: z.string() });

/** The estate's current photographs (its documents of type Photograph). */
export function useEstatePhotos(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.sub(id, 'photos'),
    queryFn: async ({ signal }) =>
      (await api.get(`/estates/${id}/documents`, { schema: z.array(EstatePhotoSchema), signal })).data.filter(
        (doc) => doc.document_type.code === PHOTOGRAPH,
      ),
  });
}

/**
 * A short-lived link to show one photograph. It expires after a few minutes, so it is fetched when shown and
 * refetched well before it runs out.
 */
export function usePhotoUrl(documentId: string) {
  return useQuery({
    queryKey: estateKeys.sub(documentId, 'photo-url'),
    staleTime: 2 * 60_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) =>
      (await api.get(`/documents/${documentId}/download`, { schema: DownloadSchema, signal })).data.url,
  });
}

export function useUploadPhoto(estateId: string) {
  return useApiMutation({
    mutationFn: async ({
      file,
      title,
      documentTypeId,
    }: {
      readonly file: File;
      readonly title: string;
      readonly documentTypeId: string;
    }) => {
      const form = new FormData();
      form.append('document_type_id', documentTypeId);
      form.append('title', title);
      form.append('file', file);
      return (await api.post(`/estates/${estateId}/documents`, form, { schema: EstatePhotoSchema })).data;
    },
    invalidates: () => [estateKeys.sub(estateId, 'photos'), estateKeys.sub(estateId, 'summary')],
  });
}

/** Removes a photograph from the gallery (the file and its record are kept, archived). */
export function useRemovePhoto(estateId: string) {
  return useApiMutation({
    mutationFn: async (photo: EstatePhoto) => {
      await api.delete(`/documents/${photo.id}`);
    },
    invalidates: () => [estateKeys.sub(estateId, 'photos'), estateKeys.sub(estateId, 'summary')],
  });
}
