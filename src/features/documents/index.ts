import { type RouteObject } from 'react-router';

/**
 * Published API of the documents feature (P1.12): the attachments panel any record's page can show, and the
 * Expiring documents page. Records choose a panel by their API path and permission module; nothing else of this
 * feature is used from outside.
 */
export { AttachmentsPanel, type AttachmentsPanelProps } from './components/AttachmentsPanel';

/** Documents about to expire across all records (document.view). */
export const expiringDocumentsRoutes: RouteObject[] = [
  { path: 'documents/expiring', lazy: () => import('./pages/ExpiringDocumentsPage') },
];

/** MSW mocks for VITE_MOCK_API=documents (development only; loaded on demand). */
export const loadDocumentsMocks = () => import('./api/mocks');
