import { useQuery } from '@tanstack/react-query';
import type { Geometry } from 'geojson';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, useApiMutation } from '@/lib/query';
import { type MapFeature } from '@/ui';

import { estateKeys, fieldKeys } from './hierarchy';
import { type Field } from './schemas';

/**
 * Field boundaries and the estate's map (R.3 GIS). Shapes are GeoJSON in longitude, latitude order (WGS 84), as
 * Leaflet reads them. A field without a boundary is "not mapped yet": nothing is drawn for it, and nothing is made up.
 */

const GeometrySchema = z.custom<Geometry>((value) => typeof value === 'object' && value !== null);

const FeatureSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).transform(String),
  geometry: GeometrySchema,
  properties: z.looseObject({ layer: z.string(), id: z.string() }),
});

const EstateMapSchema = z.looseObject({
  estate: z.looseObject({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    latitude: z.string().nullable(),
    longitude: z.string().nullable(),
  }),
  /** [west, south, east, north]; null when nothing is mapped. */
  bbox: z.array(z.number()).length(4).nullable(),
  features: z.array(FeatureSchema),
  unmapped_field_ids: z.array(z.string()),
});
export interface EstateMap {
  readonly estate: z.infer<typeof EstateMapSchema>['estate'];
  readonly unmapped_field_ids: readonly string[];
  readonly features: readonly MapFeature[];
  readonly bbox: readonly [number, number, number, number] | null;
}

/** Every shape of one estate for its map (field.view): fields, roads, drains and section outlines. */
export function useEstateMap(estateId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.sub(estateId, 'map'),
    enabled: estateId !== '',
    queryFn: async ({ signal }): Promise<EstateMap> => {
      const { data } = await api.get(`/estates/${estateId}/map`, { schema: EstateMapSchema, signal });
      const [west, south, east, north] = data.bbox ?? [];
      return {
        ...data,
        bbox:
          west === undefined || south === undefined || east === undefined || north === undefined
            ? null
            : [west, south, east, north],
        features: data.features,
      };
    },
  });
}

const BoundarySchema = z.looseObject({
  field_id: z.string(),
  boundary: GeometrySchema.nullable(),
  centroid: z.object({ latitude: z.string(), longitude: z.string() }).nullable(),
  perimeter_km: z.string().nullable(),
  mapped_area_acres: z.string().nullable(),
  gross_area: z.string(),
  area_difference_pct: z.string().nullable(),
  boundary_warning: z.string().nullable(),
  version: z.number().int(),
});
export type FieldBoundary = z.infer<typeof BoundarySchema>;

/** One field's shape and its figures: perimeter, mapped area, and the warning when it differs from the typed area. */
export function useFieldBoundary(fieldId: string | undefined) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: fieldKeys.sub(fieldId ?? '', 'boundary'),
    enabled: fieldId !== undefined && fieldId !== '',
    queryFn: async ({ signal }) =>
      (await api.get(`/fields/${fieldId ?? ''}/boundary`, { schema: BoundarySchema, signal })).data,
  });
}

/** The three ways to give a shape: drawn (GeoJSON), a KML file's text, or typed GPS points. */
export type BoundaryInput =
  | { readonly boundary: Geometry | null }
  | { readonly kml: string }
  | { readonly points: readonly { readonly latitude: number; readonly longitude: number }[] };

/** Set, change or clear a field's shape (field.edit), with the field's version. */
export function useSetBoundary(field: Pick<Field, 'id' | 'version' | 'field_number'>) {
  return useApiMutation({
    mutationFn: async (input: BoundaryInput & { readonly version?: number }) => {
      const { version, ...body } = input;
      return (
        await api.put(`/fields/${field.id}/boundary`, body, {
          schema: BoundarySchema,
          ifMatch: version ?? field.version,
        })
      ).data;
    },
    invalidates: () => [fieldKeys.all, estateKeys.all],
    conflictSubject: () => field.field_number,
  });
}
