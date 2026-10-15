import { type RouteObject } from 'react-router';

/**
 * Published API of the workflows feature (P1.13): Admin → Workflows, the approval workflow definitions. Reading
 * (the list, one workflow, the preview) needs workflow.view; writing a draft needs workflow.create or workflow.edit,
 * checked again by the route guard.
 */
export const workflowRoutes: RouteObject[] = [
  { path: 'admin/workflows', lazy: () => import('./pages/WorkflowsPage') },
  { path: 'admin/workflows/:id', lazy: () => import('./pages/WorkflowPage') },
];
/** A new workflow, and the next version of an active one (workflow.create). */
export const workflowCreateRoutes: RouteObject[] = [
  { path: 'admin/workflows/new', lazy: () => import('./pages/WorkflowEditorPage') },
  { path: 'admin/workflows/:id/new-version', lazy: () => import('./pages/WorkflowEditorPage') },
];
/** Editing a draft (workflow.edit). */
export const workflowEditRoutes: RouteObject[] = [
  { path: 'admin/workflows/:id/edit', lazy: () => import('./pages/WorkflowEditorPage') },
];

/** MSW mocks for VITE_MOCK_API=workflows (development only; loaded on demand). */
export const loadWorkflowsMocks = () => import('./api/mocks');
