import { createQueryKeys } from '@/lib/query';

/** Query keys for the admin screens (lib/query key-factory convention). */
export const userKeys = createQueryKeys('users');
export const roleKeys = createQueryKeys('roles');
export const permissionKeys = createQueryKeys('permissions');
