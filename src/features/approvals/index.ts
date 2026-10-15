import { type RouteObject } from 'react-router';

/**
 * Published API of the approvals feature (P1.14): the waiting-approvals count for the top bar, the queue and one
 * approval (any signed-in user: what they may decide is the server's answer), and the all-approvals list
 * (workflow.view) with its exceptions, and the delegations (user.view).
 */
export { useApprovalsWaiting } from './api/approvals';

export const approvalRoutes: RouteObject[] = [
  { path: 'approvals', lazy: () => import('./pages/ApprovalQueuePage') },
  { path: 'approvals/:id', lazy: () => import('./pages/ApprovalPage') },
];
export const allApprovalRoutes: RouteObject[] = [
  { path: 'approvals/all', lazy: () => import('./pages/AllApprovalsPage') },
  { path: 'approvals/exceptions', lazy: () => import('./pages/ExceptionsPage') },
];
/** Delegations (user.view; starting and ending one needs user.edit). */
export const delegationRoutes: RouteObject[] = [
  { path: 'approvals/delegations', lazy: () => import('./pages/DelegationsPage') },
];

/** MSW mocks for VITE_MOCK_API=approvals (development only; loaded on demand). */
export const loadApprovalsMocks = () => import('./api/mocks');
