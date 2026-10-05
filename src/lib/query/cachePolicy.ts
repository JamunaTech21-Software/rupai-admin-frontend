/**
 * The cache policy table (Spec P5 §4.2): how long each kind of data is trusted before it is fetched again.
 * Every query names its policy, so freshness is a decision made once per kind of data, not per screen.
 *
 * | policy          | examples                                          | stale after | kept unused | refetch on focus |
 * | --------------- | ------------------------------------------------- | ----------- | ----------- | ---------------- |
 * | `session`       | /auth/me, the user's permissions and scope        | never*      | session     | no               |
 * | `reference`     | permission catalogue, units, lookups, SoD rules   | 1 hour      | 24 hours    | no               |
 * | `master`        | users, roles, estates, workers, gangs             | 5 minutes   | 30 minutes  | yes              |
 * | `transactional` | musters, vouchers, payroll runs and their lists   | 30 seconds  | 10 minutes  | yes              |
 * | `live`          | dashboards, approval inbox, job status            | 0           | 5 minutes   | yes (+ 60 s poll)|
 *
 * (*) until a mutation or sign-in/out invalidates it. Mutations invalidate what they change, whatever the policy.
 */
export type CachePolicy = 'session' | 'reference' | 'master' | 'transactional' | 'live';

const MINUTE = 60_000;

export const CACHE_POLICIES = {
  session: {
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  },
  reference: { staleTime: 60 * MINUTE, gcTime: 24 * 60 * MINUTE, refetchOnWindowFocus: false },
  master: { staleTime: 5 * MINUTE, gcTime: 30 * MINUTE, refetchOnWindowFocus: true },
  transactional: { staleTime: 30_000, gcTime: 10 * MINUTE, refetchOnWindowFocus: true },
  live: { staleTime: 0, gcTime: 5 * MINUTE, refetchOnWindowFocus: true, refetchInterval: MINUTE },
} as const satisfies Record<
  CachePolicy,
  { staleTime: number; gcTime: number; refetchOnWindowFocus: boolean; refetchInterval?: number }
>;

/** Spread into useQuery options: `useQuery({ ...cachePolicy('master'), queryKey, queryFn })`. */
export function cachePolicy(policy: CachePolicy) {
  return CACHE_POLICIES[policy];
}
