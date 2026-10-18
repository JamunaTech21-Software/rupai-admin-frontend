import { lazy, Suspense } from 'react';

import { type BoundaryEditorProps } from './BoundaryEditor';
import { type FieldMapProps } from './FieldMap';
import { Skeleton } from './Skeleton';

const FieldMap = lazy(() => import('./FieldMap'));
const BoundaryEditor = lazy(() => import('./BoundaryEditor'));

/** FieldMap, downloaded only when a page shows it. A placeholder holds its place. */
export function LazyFieldMap(props: FieldMapProps) {
  return (
    <Suspense fallback={<Skeleton variant="block" className="h-80 w-full" />}>
      <FieldMap {...props} />
    </Suspense>
  );
}

/** BoundaryEditor (Leaflet and Geoman), downloaded only when a page draws a shape. */
export function LazyBoundaryEditor(props: BoundaryEditorProps) {
  return (
    <Suspense fallback={<Skeleton variant="block" className="h-96 w-full" />}>
      <BoundaryEditor {...props} />
    </Suspense>
  );
}
