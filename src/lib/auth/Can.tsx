import { type ReactNode } from 'react';

import { type PermissionCode, usePermission } from './permissions';

export interface CanProps {
  /** One code, or several that are all required. */
  readonly permission: PermissionCode | readonly PermissionCode[];
  /** What to show instead when the permission is missing (default: nothing). */
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

/** Renders its children only for users with the permission. */
export function Can({ permission, fallback = null, children }: CanProps) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
