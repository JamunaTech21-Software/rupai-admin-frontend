import { type RouteObject } from 'react-router';

/**
 * Published API of the imports feature (P1.17): the import wizard for every kind of file (Imports, for everyone
 * signed in: what each may import is the server's answer per type), and "Import from file" buttons for the lists
 * that can be filled from a spreadsheet.
 */
export { ImportButton } from './components/ImportButton';

export const importRoutes: RouteObject[] = [
  { path: 'imports', lazy: () => import('./pages/ImportsPage') },
  { path: 'imports/new', lazy: () => import('./pages/ImportNewPage') },
  { path: 'imports/:id', lazy: () => import('./pages/ImportBatchPage') },
];

/** MSW mocks for VITE_MOCK_API=imports (development only; loaded on demand). */
export const loadImportsMocks = () => import('./api/mocks');
