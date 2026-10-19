import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';

import type { Geometry } from 'geojson';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { cx } from './cx';

export interface BoundaryEditorProps {
  /** What the map is, for screen readers ("Draw the boundary of A-N1-1"). */
  readonly label: string;
  /** A road or drain is a line; every other field a polygon. */
  readonly shape: 'Polygon' | 'LineString';
  /** The shape now, as GeoJSON (longitude, latitude); none until one is drawn. */
  readonly value: Geometry | null;
  /** Called with the new shape when it is drawn or its points are moved, and with null when it is removed. */
  readonly onChange: (value: Geometry | null) => void;
  /** Where to look when there is no shape yet: the estate's own point, if it has one. */
  readonly center: { readonly lat: number; readonly lng: number } | null;
  readonly className?: string;
}

const COUNTRY: L.LatLngTuple = [23.7, 90.4];
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const STYLE: L.PathOptions = { color: '#1b5e4b', weight: 3, fillColor: '#1b5e4b', fillOpacity: 0.35 };

/**
 * Draw or edit one shape on a map (Leaflet Geoman): the toolbar draws a polygon (or a line), moves its points and
 * removes it. The shape is reported as GeoJSON, which is what the API takes. Only one shape exists at a time: drawing
 * a new one replaces the old. The tool tips are Geoman's own, in English. Load it through LazyBoundaryEditor.
 */
export function BoundaryEditor({ label, shape, value, onChange, center, className }: BoundaryEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.Layer | null>(null);
  /** The last shape this editor reported, so an outside change is told from an echo of its own. */
  const reported = useRef<string>('');
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);

  const report = (geometry: Geometry | null) => {
    reported.current = JSON.stringify(geometry);
    change.current(geometry);
  };

  // Create the map once, with its drawing toolbar.
  useEffect(() => {
    if (!container.current) return undefined;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(COUNTRY, 7);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    instance.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawCircle: false,
      drawRectangle: false,
      drawText: false,
      drawPolyline: shape === 'LineString',
      drawPolygon: shape === 'Polygon',
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: true,
    });
    instance.pm.setPathOptions(STYLE);

    const adopt = (next: L.Layer) => {
      if (layer.current && layer.current !== next) instance.removeLayer(layer.current);
      layer.current = next;
      next.on('pm:edit', () => {
        report((next as L.Polygon | L.Polyline).toGeoJSON().geometry);
      });
    };
    instance.on('pm:create', (event) => {
      adopt(event.layer);
      report((event.layer as L.Polygon | L.Polyline).toGeoJSON().geometry);
    });
    instance.on('pm:remove', (event) => {
      if (event.layer === layer.current) {
        layer.current = null;
        report(null);
      }
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
    // The toolbar is built for one kind of shape; a different kind is a different editor.
  }, [shape]);

  // Show a shape that came from outside (the saved one, an imported file, typed points).
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const incoming = JSON.stringify(value);
    if (incoming === reported.current) return;
    reported.current = incoming;
    if (layer.current) {
      instance.removeLayer(layer.current);
      layer.current = null;
    }
    if (!value) {
      if (center) instance.setView([center.lat, center.lng], 14);
      return;
    }
    const drawn = L.geoJSON(value, { style: () => STYLE });
    const inner = drawn.getLayers()[0];
    if (!inner) return;
    instance.addLayer(inner);
    layer.current = inner;
    inner.on('pm:edit', () => {
      report((inner as L.Polygon | L.Polyline).toGeoJSON().geometry);
    });
    instance.fitBounds(drawn.getBounds(), { maxZoom: 18, padding: [24, 24] });
  }, [value, center]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className={cx('z-0 h-96 w-full overflow-hidden rounded-md border border-line', className)}
    />
  );
}

export default BoundaryEditor;
