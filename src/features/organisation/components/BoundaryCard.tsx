import type { Geometry } from 'geojson';
import { useRef, useState } from 'react';

import { usePermission } from '@/lib/auth';
import { describeError, isApiError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, Card, LazyBoundaryEditor, Textarea, toast } from '@/ui';

import { type BoundaryInput, useFieldBoundary, useSetBoundary } from '../api/boundaries';
import { type Field } from '../api/schemas';

/** A file larger than this is refused before it is read (the server takes about 1 MB of text). */
const MAX_FILE_BYTES = 900_000;
/** A coordinate in degrees: a plain signed decimal. */
const DEGREES = /^-?\d{1,3}(\.\d+)?$/;
const LINE_TYPES: readonly string[] = ['road_reserve', 'road_side', 'drain'];

/** The shape in a GeoJSON file: a geometry, a feature, or the first feature of a collection. */
function geometryOf(value: unknown): Geometry | null {
  if (typeof value !== 'object' || value === null) return null;
  const node = value as { type?: unknown; geometry?: unknown; features?: unknown };
  if (node.type === 'Polygon' || node.type === 'LineString') return value as Geometry;
  if (node.type === 'Feature') return geometryOf(node.geometry);
  if (node.type === 'FeatureCollection' && Array.isArray(node.features)) return geometryOf(node.features[0]);
  return null;
}

/** The JSON in a file's text; null when it is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Latitude, longitude per line ("23.7001, 90.4002"); null when a line is not a pair of numbers. */
function pointsOf(text: string) {
  const points: { latitude: number; longitude: number }[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parts = line.split(/[,\s]+/).filter((part) => part !== '');
    const [lat, lng] = parts;
    if (parts.length !== 2 || !DEGREES.test(lat ?? '') || !DEGREES.test(lng ?? '')) return null;
    points.push({ latitude: +(lat ?? ''), longitude: +(lng ?? '') });
  }
  return points;
}

/**
 * A field's boundary on the map (field.edit to change it): draw or move the shape, import a GeoJSON or KML file, or type
 * GPS points. The server works out the perimeter and the mapped area, and warns when that differs from the typed area.
 */
export function BoundaryCard({ field }: { readonly field: Field }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canEdit = usePermission('field.edit');
  const saved = useFieldBoundary(field.id);
  const set = useSetBoundary(field);
  const file = useRef<HTMLInputElement>(null);
  /** The shape being drawn and not yet saved; undefined while the saved one is shown. */
  const [draft, setDraft] = useState<Geometry | null | undefined>(undefined);
  const [points, setPoints] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const shape = LINE_TYPES.includes(field.field_type) ? 'LineString' : 'Polygon';
  const shown = draft === undefined ? (saved.data?.boundary ?? null) : draft;
  const figures = saved.data;

  const send = async (input: BoundaryInput) => {
    setProblem(null);
    try {
      await set.mutateAsync(input);
      setDraft(undefined);
      setPoints('');
      toast.success(t('boundary.saved'));
    } catch (error) {
      // The server says what is wrong with the shape (a point outside the country, a file with no shape).
      const detail = isApiError(error) ? error.fieldErrors[0]?.message : undefined;
      setProblem(detail ?? describeError(error).message);
    }
  };

  const importFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    setProblem(null);
    if (chosen.size > MAX_FILE_BYTES) {
      setProblem(t('boundary.fileTooBig'));
      return;
    }
    const text = await chosen.text();
    if (text.trimStart().startsWith('<')) {
      await send({ kml: text });
      return;
    }
    const geometry = geometryOf(parseJson(text));
    if (!geometry) {
      setProblem(t('boundary.notAShape'));
      return;
    }
    setDraft(geometry);
  };

  const applyPoints = async () => {
    const list = pointsOf(points);
    if (!list || list.length < (shape === 'Polygon' ? 3 : 2)) {
      setProblem(t('boundary.badPoints'));
      return;
    }
    await send({ points: list });
  };

  return (
    <Card title={t('boundary.title')} headingLevel={2}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">{t(canEdit ? 'boundary.help' : 'boundary.viewOnly')}</p>
        <LazyBoundaryEditor
          label={t('boundary.mapLabel', { number: field.field_number })}
          shape={shape}
          value={shown}
          onChange={setDraft}
          center={null}
        />
        {figures?.boundary ? (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-fg-muted">{t('boundary.perimeter')}</dt>
              <dd>{figures.perimeter_km ? `${format.decimal(figures.perimeter_km, 2)} km` : '—'}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('boundary.mappedArea')}</dt>
              <dd>
                {figures.mapped_area_acres ? `${format.decimal(figures.mapped_area_acres, 3)} acre` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('boundary.difference')}</dt>
              <dd>
                {figures.area_difference_pct ? `${format.decimal(figures.area_difference_pct, 1)}%` : '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-fg-muted">{t('boundary.none')}</p>
        )}
        {figures?.boundary_warning ? (
          <p role="status" className="text-sm text-warning">
            {figures.boundary_warning}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        {canEdit ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                isDisabled={draft === undefined}
                isPending={set.isPending}
                onPress={() => {
                  void send({ boundary: draft ?? null });
                }}
              >
                {t('boundary.save')}
              </Button>
              <Button
                variant="secondary"
                isDisabled={draft === undefined}
                onPress={() => {
                  setDraft(undefined);
                  setProblem(null);
                }}
              >
                {t('boundary.discard')}
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  file.current?.click();
                }}
              >
                {t('boundary.import')}
              </Button>
              {figures?.boundary ? (
                <Button
                  variant="danger"
                  isPending={set.isPending}
                  onPress={() => {
                    void send({ boundary: null });
                  }}
                >
                  {t('boundary.remove')}
                </Button>
              ) : null}
              <input
                ref={file}
                type="file"
                accept=".geojson,.json,.kml,application/json,application/vnd.google-earth.kml+xml"
                className="sr-only"
                tabIndex={-1}
                aria-label={t('boundary.fileLabel')}
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Textarea
                label={t('boundary.pointsLabel')}
                hint={t('boundary.pointsHint')}
                placeholder="23.7001, 90.4002"
                rows={4}
                value={points}
                onChange={setPoints}
              />
              <div>
                <Button
                  variant="secondary"
                  isDisabled={points.trim() === ''}
                  isPending={set.isPending}
                  onPress={() => {
                    void applyPoints();
                  }}
                >
                  {t('boundary.usePoints')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
