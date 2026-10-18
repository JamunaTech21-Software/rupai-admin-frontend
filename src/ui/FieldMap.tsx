import 'leaflet/dist/leaflet.css';

import type { Geometry } from 'geojson';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import { cx } from './cx';
import { MAP_COLOURS } from './mapColours';

/** One drawn thing: a field's shape, a drain or road line, or a section's outline. */
export interface MapFeature {
  readonly id: string;
  readonly geometry: Geometry;
  /** `layer` says what it is (field, road, drain, section); `id` is the record's own id. */
  readonly properties: { readonly layer: string; readonly id: string } & Readonly<Record<string, unknown>>;
}

export interface FieldMapText {
  readonly street: string;
  readonly satellite: string;
  readonly fullscreen: string;
  readonly exitFullscreen: string;
  readonly legend: {
    readonly selected: string;
    readonly other: string;
    readonly road: string;
    readonly drain: string;
    readonly section: string;
  };
}

export interface FieldMapProps {
  /** What the map shows, for screen readers ("Map of the fields of Rupai Estate"). */
  readonly label: string;
  readonly features: readonly MapFeature[];
  /** The chosen field: highlighted, centred, and given a pin and a popup. */
  readonly selectedId: string | null;
  readonly onSelect?: (id: string) => void;
  /** The popup's lines for a field (name, area, division …). */
  readonly popup: (feature: MapFeature) => readonly string[];
  /** [west, south, east, north] of everything, to fit the view; none centres on Bangladesh. */
  readonly bbox: readonly [number, number, number, number] | null;
  readonly text: FieldMapText;
  readonly className?: string;
}

const COUNTRY: L.LatLngTuple = [23.7, 90.4];
const STREET = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';

const styleOf = (feature: MapFeature, selected: boolean): L.PathOptions => {
  switch (feature.properties.layer) {
    case 'road':
      return { color: MAP_COLOURS.road, weight: selected ? 6 : 3, dashArray: '8 6', fill: false };
    case 'drain':
      return { color: MAP_COLOURS.drain, weight: selected ? 6 : 3, dashArray: '8 6', fill: false };
    case 'section':
      return { color: MAP_COLOURS.section, weight: 2, fill: false, interactive: false };
    default:
      return selected
        ? { color: MAP_COLOURS.selected, weight: 3, fillColor: MAP_COLOURS.selected, fillOpacity: 0.45 }
        : { color: MAP_COLOURS.other, weight: 1.5, fillColor: MAP_COLOURS.other, fillOpacity: 0.25 };
  }
};

/**
 * The estate's map (OpenStreetMap or satellite tiles through Leaflet): every field's shape, the chosen one
 * highlighted with a pin and a popup, roads and drains dashed, section outlines in yellow, with a street / satellite
 * switch, zoom, fullscreen and the legend. Shapes are GeoJSON in longitude, latitude order, as the API sends them.
 * Load it through LazyFieldMap, so Leaflet is only downloaded by pages that show a map.
 */
export function FieldMap({
  label,
  features,
  selectedId,
  onSelect,
  popup,
  bbox,
  text,
  className,
}: FieldMapProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.FeatureGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [isFull, setIsFull] = useState(false);
  // The latest callbacks, for handlers the layers were created with.
  const select = useRef(onSelect);
  const describe = useRef(popup);
  useEffect(() => {
    select.current = onSelect;
    describe.current = popup;
  }, [onSelect, popup]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return undefined;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(COUNTRY, 7);
    tiles.current = L.tileLayer(STREET, { attribution: STREET_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    layers.current = L.featureGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layers.current = null;
      tiles.current = null;
    };
  }, []);

  // Street or satellite.
  useEffect(() => {
    tiles.current?.setUrl(isSatellite ? SATELLITE : STREET);
    const attribution = map.current?.attributionControl;
    if (attribution) {
      attribution.removeAttribution(STREET_ATTRIBUTION);
      attribution.removeAttribution(SATELLITE_ATTRIBUTION);
      attribution.addAttribution(isSatellite ? SATELLITE_ATTRIBUTION : STREET_ATTRIBUTION);
    }
  }, [isSatellite]);

  // Draw the shapes.
  useEffect(() => {
    const instance = map.current;
    const group = layers.current;
    if (!instance || !group) return;
    group.clearLayers();
    let selectedBounds: L.LatLngBounds | null = null;
    let selectedFeature: MapFeature | null = null;
    // Sections at the back, then fields, then roads and drains on top.
    const order = ['section', 'field', 'road', 'drain'];
    const sorted = [...features].sort(
      (a, b) => order.indexOf(a.properties.layer) - order.indexOf(b.properties.layer),
    );
    for (const feature of sorted) {
      const isSelected = feature.properties.layer !== 'section' && feature.properties.id === selectedId;
      const layer = L.geoJSON(feature.geometry, { style: () => styleOf(feature, isSelected) });
      if (feature.properties.layer !== 'section') {
        layer.on('click', () => {
          select.current?.(feature.properties.id);
        });
      }
      layer.addTo(group);
      if (isSelected) {
        selectedBounds = layer.getBounds();
        selectedFeature = feature;
        layer.bringToFront();
      }
    }
    if (selectedBounds && selectedFeature) {
      const center = selectedBounds.getCenter();
      const pin = L.circleMarker(center, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: MAP_COLOURS.selected,
        fillOpacity: 1,
      }).addTo(group);
      const body = document.createElement('div');
      for (const line of describe.current(selectedFeature)) {
        const row = document.createElement('div');
        row.textContent = line;
        body.append(row);
      }
      pin.bindPopup(body);
      instance.fitBounds(selectedBounds, { maxZoom: 17, padding: [24, 24] });
    } else if (bbox) {
      instance.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [24, 24] },
      );
    } else {
      instance.setView(COUNTRY, 7);
    }
  }, [features, selectedId, bbox]);

  // Fullscreen follows the browser's own state (Escape leaves it too).
  useEffect(() => {
    const change = () => {
      setIsFull(document.fullscreenElement === wrapper.current);
      window.setTimeout(() => {
        map.current?.invalidateSize();
      }, 100);
    };
    document.addEventListener('fullscreenchange', change);
    return () => {
      document.removeEventListener('fullscreenchange', change);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapper.current?.requestFullscreen();
  };
  const choice = (active: boolean) =>
    cx(
      'px-2.5 py-1 text-xs font-medium',
      active ? 'bg-primary text-fg-inverse' : 'bg-surface text-fg hover:bg-surface-subtle',
    );

  return (
    <div className="flex flex-col gap-2">
      <div ref={wrapper} className={cx('relative z-0 bg-surface', isFull && 'h-full')}>
        <div
          ref={container}
          role="region"
          aria-label={label}
          className={cx(
            'z-0 w-full overflow-hidden rounded-md border border-line',
            isFull ? 'h-full min-h-dvh' : 'h-80',
            className,
          )}
        />
        <div className="absolute end-2 top-2 z-[500] flex items-center gap-2">
          <span className="inline-flex overflow-hidden rounded-md border border-line-strong shadow-sm">
            <button
              type="button"
              aria-pressed={!isSatellite}
              className={choice(!isSatellite)}
              onClick={() => {
                setIsSatellite(false);
              }}
            >
              {text.street}
            </button>
            <button
              type="button"
              aria-pressed={isSatellite}
              className={choice(isSatellite)}
              onClick={() => {
                setIsSatellite(true);
              }}
            >
              {text.satellite}
            </button>
          </span>
          <button
            type="button"
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-sm hover:bg-surface-subtle"
            onClick={toggleFullscreen}
          >
            {isFull ? text.exitFullscreen : text.fullscreen}
          </button>
        </div>
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {(
          [
            ['selected', text.legend.selected, 'solid'],
            ['other', text.legend.other, 'solid'],
            ['road', text.legend.road, 'dashed'],
            ['drain', text.legend.drain, 'dashed'],
            ['section', text.legend.section, 'solid'],
          ] as const
        ).map(([key, name, kind]) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0 w-5 border-t-2"
              style={{ borderColor: MAP_COLOURS[key], borderTopStyle: kind }}
            />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FieldMap;
