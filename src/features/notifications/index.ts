import { type RouteObject } from 'react-router';

/**
 * Published API of the notifications feature (P1.16): the bell for the top bar, the user's own notifications at
 * /notifications (no permission: everyone has their own), and Admin → Notification rules (notification.view).
 */
export { NotificationBell } from './components/NotificationBell';

export const notificationRoutes: RouteObject[] = [
  { path: 'notifications', lazy: () => import('./pages/NotificationsPage') },
];
export const notificationRuleRoutes: RouteObject[] = [
  { path: 'admin/notification-rules', lazy: () => import('./pages/NotificationRulesPage') },
];

/** MSW mocks for VITE_MOCK_API=notifications (development only; loaded on demand). */
export const loadNotificationsMocks = () => import('./api/mocks');
