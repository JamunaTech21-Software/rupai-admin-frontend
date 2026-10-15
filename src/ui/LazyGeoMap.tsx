import { lazy, Suspense } from 'react';

import { type GeoMapProps } from './GeoMap';
import { Skeleton } from './Skeleton';

const GeoMap = lazy(() => import('./GeoMap'));

/** GeoMap, downloaded only when a page shows it (Leaflet is about 40 KB). A placeholder holds its place. */
export function LazyGeoMap(props: GeoMapProps) {
  return (
    <Suspense fallback={<Skeleton variant="block" className="h-64 w-full" />}>
      <GeoMap {...props} />
    </Suspense>
  );
}
