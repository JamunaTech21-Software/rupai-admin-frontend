import { type RouteObject } from 'react-router';

/**
 * Published API of the organisation feature (P1.07): organisation settings, estates with their divisions and
 * sections, and fields. Pages are lazy; the app wraps each group in the permission guard it needs.
 */
export const organisationRoutes: RouteObject[] = [
  { path: 'organisation', lazy: () => import('./pages/OrganisationPage') },
];
export const estateRoutes: RouteObject[] = [
  { path: 'estates', lazy: () => import('./pages/EstatesPage') },
  { path: 'estates/:id', lazy: () => import('./pages/EstatePage') },
];
export const estateCreateRoutes: RouteObject[] = [
  { path: 'estates/new', lazy: () => import('./pages/EstatePage') },
];
export const fieldRoutes: RouteObject[] = [
  { path: 'fields', lazy: () => import('./pages/FieldsPage') },
  { path: 'fields/:id', lazy: () => import('./pages/FieldPage') },
];
export const fieldCreateRoutes: RouteObject[] = [
  { path: 'fields/new', lazy: () => import('./pages/FieldPage') },
];

/** Factories, warehouses and parties (P1.08), each with its own view / create permission. */
export const factoryRoutes: RouteObject[] = [
  { path: 'factories', lazy: () => import('./pages/FactoriesPage') },
  { path: 'factories/:id', lazy: () => import('./pages/FactoryPage') },
];
export const factoryCreateRoutes: RouteObject[] = [
  { path: 'factories/new', lazy: () => import('./pages/FactoryPage') },
];
export const warehouseRoutes: RouteObject[] = [
  { path: 'warehouses', lazy: () => import('./pages/WarehousesPage') },
  { path: 'warehouses/:id', lazy: () => import('./pages/WarehousePage') },
];
export const warehouseCreateRoutes: RouteObject[] = [
  { path: 'warehouses/new', lazy: () => import('./pages/WarehousePage') },
];
export const partyRoutes: RouteObject[] = [
  { path: 'parties', lazy: () => import('./pages/PartiesPage') },
  { path: 'parties/:id', lazy: () => import('./pages/PartyPage') },
];
export const partyCreateRoutes: RouteObject[] = [
  { path: 'parties/new', lazy: () => import('./pages/PartyPage') },
];

/** MSW mocks for VITE_MOCK_API=organisation (development only; loaded on demand). */
export const loadOrganisationMocks = () => import('./api/mocks');
