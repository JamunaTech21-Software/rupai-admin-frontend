import { usePermission } from '@/lib/auth';
import { lookupOption, lookupText, useActiveLookups } from '@/lib/lookups';

import { useEstateOptions } from '../api/masters';
import { type RefTarget } from '../masters';

/**
 * The rows a reference field may point to, as options: the active rows of another master, or the estates the
 * user may see. Only active rows are listed, so a value that has since been deactivated has no label here.
 */
export function useRefOptions(to: RefTarget | null) {
  const canReadLookups = usePermission('lookup.view');
  const canReadEstates = usePermission('estate.view');
  const lookupsWanted = to !== null && to !== 'estate' && canReadLookups;
  const estatesWanted = to === 'estate' && canReadEstates;
  const lookups = useActiveLookups(to !== null && to !== 'estate' ? to : 'department', lookupsWanted);
  const estates = useEstateOptions(estatesWanted);

  const options =
    to === 'estate'
      ? (estates.data ?? []).map((estate) => ({ id: estate.id, label: `${estate.code} · ${estate.name}` }))
      : to === null
        ? []
        : (lookups.data ?? []).map(lookupOption);
  return {
    options,
    isPending: (lookupsWanted && lookups.isPending) || (estatesWanted && estates.isPending),
    labelOf: (id: string) => options.find((option) => option.id === id)?.label,
    /** The short form for a table cell: an estate's code, another master's name. */
    shortOf: (id: string) =>
      to === 'estate'
        ? estates.data?.find((estate) => estate.id === id)?.code
        : lookupText(
            lookups.data?.find((row) => row.id === id),
            'name',
          ) || undefined,
  };
}
