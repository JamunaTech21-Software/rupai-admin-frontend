import { useMe } from './me';

/**
 * Permission-aware UI (Spec P5 §9). `<Can>` and `usePermission()` are the ONLY ways a screen gates anything on
 * permissions, so the rules live in one place. The server still enforces every permission; this only decides
 * what the user is shown.
 *
 * Codes are the backend's `resource.action` (user.view, role.edit, audit.export). `*` grants everything (mock
 * administrator).
 *
 * Hide or disable (Spec P5 Table 9.1):
 *
 * | situation                                                        | rule                                           |
 * | ---------------------------------------------------------------- | ---------------------------------------------- |
 * | navigation, pages and whole sections the role never has          | hide (sidebar entry, route → 403)              |
 * | an action the role never has (Delete, Export, Approve)           | hide                                           |
 * | an action the role has, but this record's state forbids          | disable, and say why (tooltip or note)         |
 * | a read-only view of something the user may see but not change    | show it, with the PermissionNotice             |
 *
 * So `<Can>` hides. For the disable case a screen combines the two facts itself:
 * `isDisabled={!usePermission('muster.approve') || muster.status !== 'submitted'}`, never by hiding.
 */
export type PermissionCode = string;

export function hasPermission(granted: readonly string[] | undefined, code: PermissionCode): boolean {
  if (!granted) return false;
  return granted.includes('*') || granted.includes(code);
}

/**
 * Whether the signed-in user holds a permission (all of them, given a list):
 * `const canEdit = usePermission('user.edit');`
 */
export function usePermission(code: PermissionCode | readonly PermissionCode[]): boolean {
  const me = useMe();
  const codes = typeof code === 'string' ? [code] : code;
  return codes.every((c) => hasPermission(me?.permissions, c));
}

/** The permission check as a function, for filtering lists (sidebar entries, menu items). */
export function usePermissionCheck(): (code: PermissionCode | undefined) => boolean {
  const me = useMe();
  return (code) => code === undefined || hasPermission(me?.permissions, code);
}
