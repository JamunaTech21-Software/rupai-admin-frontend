import { type RouteObject } from 'react-router';

/** The estates a user may pick from (other features offer them as a "garden / unit" choice). */
export { useAllEstates, useDivisions, useEstateSections } from './api/hierarchy';
export { ScopeNotice } from './components/ScopeNotice';
export { ContactsPanel } from './components/ContactsPanel';

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
  /** Estate Management tabs (R.3). */
  { path: 'estates/:id/divisions', lazy: () => import('./pages/EstateDivisionsPage') },
  { path: 'estates/:id/fields', lazy: () => import('./pages/EstateFieldsPage') },
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

/** Calendars (P1.09): seasons per estate; fiscal years and accounting periods for the organisation. */
export const seasonRoutes: RouteObject[] = [
  { path: 'seasons', lazy: () => import('./pages/SeasonsPage') },
  { path: 'seasons/:id', lazy: () => import('./pages/SeasonPage') },
];
export const seasonCreateRoutes: RouteObject[] = [
  { path: 'seasons/new', lazy: () => import('./pages/SeasonPage') },
];
export const fiscalYearRoutes: RouteObject[] = [
  { path: 'fiscal-years', lazy: () => import('./pages/FiscalYearsPage') },
  { path: 'fiscal-years/:id', lazy: () => import('./pages/FiscalYearPage') },
];
export const periodRoutes: RouteObject[] = [
  { path: 'accounting-periods', lazy: () => import('./pages/PeriodsPage') },
];

/** MSW mocks for VITE_MOCK_API=organisation (development only; loaded on demand). */
export const loadOrganisationMocks = () => import('./api/mocks');
