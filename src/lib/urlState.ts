import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Screen state that belongs in the address (Spec P5 §6.3): the open tab, a table's sort, filters and page. Kept
 * in the URL query string, so a view can be bookmarked, shared, reloaded and reached with Back. ui components
 * stay router-agnostic and controlled; these hooks connect them to the URL:
 *
 *   <Tabs {...useUrlTab('tab', 'overview')} items={…} />
 *   <Pagination {...useUrlPage()} totalItems={…} />
 *   const table = useUrlTableState({ defaultSort: '-created_at' }); <DataTable {...table.bind} … />
 *
 * Table state uses the backend's own list grammar (backend/src/core/http/list-query.ts, Spec P4 §2.5–2.6):
 * `page`, `per_page`, `sort=field,-other`, `filter[field][op]=value`. The page's query string is therefore the
 * API query: `table.apiQuery` is what the data layer sends.
 *
 * Changes replace the current history entry, so clicking through tabs or pages does not fill Back with them.
 */

type Updates = Readonly<Record<string, string | null>>;

/** Applies changes to the query string: null removes a key. Other keys are kept. */
function useQueryUpdater() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: Updates) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [params, update] as const;
}

/** One query-string parameter as state. Setting it to the default (or null) removes it, keeping URLs short. */
export function useUrlParam(
  name: string,
  defaultValue: string,
): readonly [value: string, setValue: (next: string | null) => void] {
  const [params, update] = useQueryUpdater();
  const value = params.get(name) ?? defaultValue;
  const setValue = useCallback(
    (next: string | null) => {
      update({ [name]: next === defaultValue ? null : next });
    },
    [name, defaultValue, update],
  );
  return [value, setValue] as const;
}

/** The open tab, for `<Tabs {...useUrlTab('tab', 'overview')} />`. */
export function useUrlTab(name: string, defaultTab: string) {
  const [selectedKey, setSelectedKey] = useUrlParam(name, defaultTab);
  return { selectedKey, onSelectionChange: setSelectedKey };
}

// ---- Pages --------------------------------------------------------------------------------------------------

/** The API's page-size limit (list-query.ts clamps per_page to 200). */
export const MAX_PAGE_SIZE = 200;

/** A positive whole number from the query string, falling back when missing or malformed ("?page=abc"). */
function toPositiveInt(raw: string | null, fallback: number, max = 9_999_999): number {
  if (!raw || !/^[1-9]\d{0,6}$/.test(raw)) return fallback;
  return Math.min(Number.parseInt(raw, 10), max);
}

interface PageOptions {
  readonly pageSize?: number;
}

function readPage(params: URLSearchParams, defaultSize: number) {
  return {
    page: toPositiveInt(params.get('page'), 1),
    pageSize: toPositiveInt(params.get('per_page'), defaultSize, MAX_PAGE_SIZE),
  };
}

/** Page and page size, for `<Pagination {...useUrlPage()} />`. Changing the page size goes back to page 1. */
export function useUrlPage(options: PageOptions = {}) {
  const { pageSize: defaultSize = 25 } = options;
  const [params, update] = useQueryUpdater();
  const { page, pageSize } = readPage(params, defaultSize);
  return {
    page,
    pageSize,
    onPageChange: useCallback(
      (next: number) => {
        update({ page: next === 1 ? null : String(next) });
      },
      [update],
    ),
    onPageSizeChange: useCallback(
      (next: number) => {
        update({ per_page: next === defaultSize ? null : String(next), page: null });
      },
      [update, defaultSize],
    ),
  };
}

// ---- Sort ---------------------------------------------------------------------------------------------------

/** One sort key: a column id (the API's field name) and its direction. */
export interface SortTerm {
  readonly id: string;
  readonly desc: boolean;
}

const SORT_FIELD = /^-?[a-z][a-z0-9_.]*$/;

/** `"name,-created_at"` → `[{id:'name',desc:false},{id:'created_at',desc:true}]`. Malformed parts are dropped. */
export function parseSort(raw: string | null): SortTerm[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => SORT_FIELD.test(part))
    .map((part) => (part.startsWith('-') ? { id: part.slice(1), desc: true } : { id: part, desc: false }));
}

export function formatSort(sort: readonly SortTerm[]): string {
  return sort.map((term) => (term.desc ? `-${term.id}` : term.id)).join(',');
}

// ---- Filters ------------------------------------------------------------------------------------------------

/**
 * Filters as the API spells them, keyed by their full parameter name: `{ 'filter[status]': 'active',
 * 'filter[username][like]': 'rah' }`.
 */
export type UrlFilters = Readonly<Record<string, string>>;

/** The parameter name for a filter: `filterKey('status')` → `filter[status]`, with an operator `filter[x][in]`. */
export function filterKey(field: string, op?: 'in' | 'from' | 'to' | 'like' | 'null'): string {
  return op ? `filter[${field}][${op}]` : `filter[${field}]`;
}

function readFilters(params: URLSearchParams): UrlFilters {
  const filters: Record<string, string> = {};
  for (const [key, value] of params) if (key.startsWith('filter[') && value !== '') filters[key] = value;
  return filters;
}

// ---- A whole table ------------------------------------------------------------------------------------------

export interface TableUrlOptions {
  /** The sort when the URL has none, in API form: `"-created_at"`. Not written to the URL. */
  readonly defaultSort?: string;
  readonly pageSize?: number;
}

/**
 * A server-side table's sort, filters and page in the URL. Changing the sort or a filter goes back to page 1,
 * so the user never lands on an empty page 7 of a narrower result.
 */
export function useUrlTableState(options: TableUrlOptions = {}) {
  const { defaultSort = '', pageSize: defaultSize = 25 } = options;
  const [params, update] = useQueryUpdater();
  const { page, pageSize } = readPage(params, defaultSize);
  const sortParam = params.get('sort');
  const sort = useMemo(() => parseSort(sortParam ?? defaultSort), [sortParam, defaultSort]);
  const search = params.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(search)), [search]);

  const onSortChange = useCallback(
    (next: readonly SortTerm[]) => {
      const value = formatSort(next);
      update({ sort: value === defaultSort ? null : value || null, page: null });
    },
    [update, defaultSort],
  );
  const setFilter = useCallback(
    (key: string, value: string | null) => {
      update({ [key]: value === '' ? null : value, page: null });
    },
    [update],
  );
  const clearFilters = useCallback(() => {
    update({ ...Object.fromEntries(Object.keys(filters).map((key) => [key, null])), page: null });
  }, [update, filters]);

  /** The list request's query string: exactly the API grammar, with defaults filled in. */
  const apiQuery = useMemo(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) query.set(key, value);
    if (sort.length > 0) query.set('sort', formatSort(sort));
    query.set('page', String(page));
    query.set('per_page', String(pageSize));
    return query.toString();
  }, [filters, sort, page, pageSize]);

  return {
    page,
    pageSize,
    sort,
    filters,
    setFilter,
    clearFilters,
    hasFilters: Object.keys(filters).length > 0,
    apiQuery,
    onSortChange,
    onPageChange: useCallback(
      (next: number) => {
        update({ page: next === 1 ? null : String(next) });
      },
      [update],
    ),
    onPageSizeChange: useCallback(
      (next: number) => {
        update({ per_page: next === defaultSize ? null : String(next), page: null });
      },
      [update, defaultSize],
    ),
  };
}
