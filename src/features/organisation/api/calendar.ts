import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import {
  type AccountingPeriod,
  AccountingPeriodSchema,
  type FiscalYear,
  FiscalYearSchema,
  type Season,
  SeasonSchema,
} from './schemas';

/**
 * Calendars (P1.09): seasons (per estate), fiscal years and their accounting periods (one calendar for the whole
 * organisation). Edits and state changes send If-Match with the version read; state changes also send an
 * Idempotency-Key.
 */

export const seasonKeys = createQueryKeys('seasons');
export const fiscalYearKeys = createQueryKeys('fiscal-years');
export const periodKeys = createQueryKeys('accounting-periods');

// ---- Seasons --------------------------------------------------------------------------------------------

export function useSeasonsList() {
  return usePagedList({
    keys: seasonKeys,
    path: '/seasons',
    row: SeasonSchema,
    defaultSort: '-start_date',
    pageSize: 25,
  });
}

export function useSeason(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: seasonKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/seasons/${id}`, { schema: SeasonSchema, signal })).data,
  });
}

export interface SeasonInput {
  readonly code: string;
  readonly name: string;
  readonly start_date: string;
  readonly end_date: string;
}

export function useCreateSeason() {
  return useApiMutation({
    mutationFn: async (input: SeasonInput & { estate_id: string }) =>
      (await api.post('/seasons', input, { schema: SeasonSchema })).data,
    invalidates: () => [seasonKeys.all],
  });
}

/** Planned: every field. Active: the server accepts a change of name and end date only. */
export function useUpdateSeason(season: Season) {
  return useApiMutation({
    mutationFn: async (input: SeasonInput) =>
      (await api.put(`/seasons/${season.id}`, input, { schema: SeasonSchema, ifMatch: season.version })).data,
    invalidates: () => [seasonKeys.all],
    conflictSubject: () => season.name,
  });
}

/** planned → active, or active → closed (POST /seasons/{id}/activate|close, If-Match, Idempotency-Key). */
export function useSeasonTransition(season: Season) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'activate' | 'close') =>
      (
        await api.post(`/seasons/${season.id}/${action}`, undefined, {
          schema: SeasonSchema,
          versioned: true,
          ifMatch: season.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [seasonKeys.all],
    conflictSubject: () => season.name,
    onSuccess: idempotency.reset,
  });
}

/** Only a planned season can be deleted. */
export function useDeleteSeason(season: Season) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/seasons/${season.id}`);
    },
    // Lists only: the deleted record's own query must not refetch (it would 404 before the page leaves).
    invalidates: () => [seasonKeys.lists()],
  });
}

// ---- Fiscal years ---------------------------------------------------------------------------------------

export function useFiscalYearsList() {
  return usePagedList({
    keys: fiscalYearKeys,
    path: '/fiscal-years',
    row: FiscalYearSchema,
    defaultSort: '-start_date',
    pageSize: 25,
  });
}

/** Every fiscal year, latest first (pickers and labels). */
export function useAllFiscalYears(enabled = true) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: fiscalYearKeys.list('all'),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get('/fiscal-years', {
          query: { per_page: 200, sort: '-start_date' },
          schema: z.array(FiscalYearSchema),
          signal,
        })
      ).data,
  });
}

export function useFiscalYear(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: fiscalYearKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/fiscal-years/${id}`, { schema: FiscalYearSchema, signal })).data,
  });
}

/** The dates follow from the start year and the organisation's fiscal year start month. */
export function useCreateFiscalYear() {
  return useApiMutation({
    mutationFn: async (input: { start_year: number }) =>
      (await api.post('/fiscal-years', input, { schema: FiscalYearSchema })).data,
    invalidates: () => [fiscalYearKeys.all],
  });
}

/** Code and name only: the dates are never edited. */
export function useUpdateFiscalYear(year: FiscalYear) {
  return useApiMutation({
    mutationFn: async (input: { code: string; name: string }) =>
      (
        await api.put(`/fiscal-years/${year.id}`, input, {
          schema: FiscalYearSchema,
          ifMatch: year.version,
        })
      ).data,
    invalidates: () => [fiscalYearKeys.all],
    conflictSubject: () => year.name,
  });
}

/** Only while the year and all its periods are still future (422 INVARIANT_VIOLATED otherwise). */
export function useDeleteFiscalYear(year: FiscalYear) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/fiscal-years/${year.id}`);
    },
    invalidates: () => [fiscalYearKeys.lists(), periodKeys.lists()],
  });
}

/** Creates the 12 monthly periods and period 13 (year-end adjustments). Once per fiscal year. */
export function useGeneratePeriods(year: FiscalYear) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async () =>
      (
        await api.post(`/fiscal-years/${year.id}/generate-periods`, undefined, {
          schema: z.array(AccountingPeriodSchema),
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [fiscalYearKeys.all, periodKeys.all],
    onSuccess: idempotency.reset,
  });
}

// ---- Accounting periods ---------------------------------------------------------------------------------

export function usePeriodsList() {
  return usePagedList({
    keys: periodKeys,
    path: '/accounting-periods',
    row: AccountingPeriodSchema,
    defaultSort: 'start_date,period_number',
    pageSize: 25,
  });
}

/** The 13 periods of one fiscal year, in order. Pass an empty id to skip the request. */
export function usePeriodsOfYear(fiscalYearId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: periodKeys.list(`year:${fiscalYearId}`),
    enabled: fiscalYearId !== '',
    queryFn: async ({ signal }) =>
      (
        await api.get('/accounting-periods', {
          query: { per_page: 50, sort: 'period_number', 'filter[fiscal_year_id]': fiscalYearId },
          schema: z.array(AccountingPeriodSchema),
          signal,
        })
      ).data,
  });
}

/** future → open, in order: 422 "Open period N (name) first." when an earlier one is still future. */
export function useOpenPeriod(period: AccountingPeriod) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async () =>
      (
        await api.post(`/accounting-periods/${period.id}/open`, undefined, {
          schema: AccountingPeriodSchema,
          versioned: true,
          ifMatch: period.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    // Opening the first period opens the fiscal year too.
    invalidates: () => [periodKeys.all, fiscalYearKeys.all],
    conflictSubject: () => period.name,
    onSuccess: idempotency.reset,
  });
}

/**
 * The next period to open in each fiscal year (its lowest-numbered future period), by fiscal year id. The lists
 * offer "Open" on that period only, whatever page or filter is showing.
 */
export function useNextPeriodsToOpen(enabled = true) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: periodKeys.list('next-to-open'),
    enabled,
    queryFn: async ({ signal }) => {
      const next = new Map<string, string>();
      for (let page = 1; ; page += 1) {
        const response = await api.get('/accounting-periods', {
          query: { per_page: 200, page, sort: 'period_number', 'filter[state]': 'future' },
          schema: z.array(AccountingPeriodSchema),
          signal,
        });
        for (const period of response.data) {
          if (!next.has(period.fiscal_year_id)) next.set(period.fiscal_year_id, period.id);
        }
        if (page >= (response.meta?.pagination?.last_page ?? page)) break;
      }
      return next;
    },
  });
}
