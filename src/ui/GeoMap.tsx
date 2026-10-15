import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { cx } from './cx';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface GeoMapProps {
  /** What the map shows, for screen readers ("Location of Rupai Estate"). */
  readonly label: string;
  /** The marked place; none centres on Bangladesh. */
  readonly point: GeoPoint | null;
  /** Lets the user place the point by clicking the map. Leave out for a read-only map. */
  readonly onPick?: (point: GeoPoint) => void;
  readonly className?: string;
}

/** Bangladesh, for a map with no point yet. */
const COUNTRY: GeoPoint = { lat: 23.7, lng: 90.4 };
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** The marker is drawn, not an image, so no marker icon files are needed. */
const MARKER: L.CircleMarkerOptions = {
  radius: 9,
  color: '#ffffff',
  weight: 3,
  fillColor: '#1b5e4b',
  fillOpacity: 1,
};

/**
 * A map with one marked place (OpenStreetMap tiles through Leaflet). The coordinates are always typed in fields
 * next to it; the map shows them, and clicking it fills them in. Load it through LazyGeoMap, so Leaflet is only
 * downloaded by pages that show a map.
 */
export function GeoMap({ label, point, onPick, className }: GeoMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  // The latest onPick, for the click handler the map was created with.
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return undefined;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
      [COUNTRY.lat, COUNTRY.lng],
      7,
    );
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      pick.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Follow the point.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!point) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const at: L.LatLngTuple = [point.lat, point.lng];
    if (marker.current) marker.current.setLatLng(at);
    else marker.current = L.circleMarker(at, MARKER).addTo(instance);
    instance.setView(at, Math.max(instance.getZoom(), 13));
  }, [point]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className={cx(
        'z-0 h-64 w-full overflow-hidden rounded-md border border-line',
        onPick && 'cursor-crosshair',
        className,
      )}
    />
  );
}

export default GeoMap;
