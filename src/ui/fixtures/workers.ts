/**
 * Demo data for DataTable stories and tests: 120 workers and a stand-in for the API's list endpoint that
 * honours the real grammar (`sort`, `filter[field]`, `filter[field][like]`, `page`, `per_page`). Not used by
 * the app.
 */
import { Dec } from '@/lib/money';

export interface DemoWorker {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly division: 'Division 1' | 'Division 2' | 'Division 3';
  readonly status: 'active' | 'disabled';
  /** kg, a decimal string. */
  readonly leaf_kg: string;
  readonly joined_on: string;
}

const FIRST = ['Rahim', 'Rina', 'Shefali', 'Abdul', 'Mina', 'Sujon', 'Laboni', 'Kamal', 'Putul', 'Joba'];
const LAST = ['Uddin', 'Begum', 'Das', 'Karim', 'Munda', 'Orang', 'Kurmi', 'Bhumij'];
const DIVISIONS = ['Division 1', 'Division 2', 'Division 3'] as const;

export const DEMO_WORKERS: readonly DemoWorker[] = Array.from({ length: 120 }, (_, i) => {
  const n = i + 1;
  const grams = 20_000 + ((n * 7919) % 45_000);
  return {
    id: `w${String(n)}`,
    code: `EMP-${String(n).padStart(5, '0')}`,
    name: `${FIRST[i % FIRST.length] ?? ''} ${LAST[(i * 3) % LAST.length] ?? ''}`,
    division: DIVISIONS[i % 3] ?? 'Division 1',
    status: n % 9 === 0 ? 'disabled' : 'active',
    leaf_kg: `${String(Math.floor(grams / 1000))}.${String(grams % 1000).padStart(3, '0')}`,
    joined_on: `20${String(15 + (n % 10))}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 27) + 1).padStart(2, '0')}`,
  };
});

export interface DemoPage {
  readonly data: DemoWorker[];
  readonly total: number;
}

function compare(a: DemoWorker, b: DemoWorker, field: keyof DemoWorker): number {
  if (field === 'leaf_kg') return new Dec(a.leaf_kg).cmp(b.leaf_kg);
  return a[field].localeCompare(b[field]);
}

/** What `GET /workers?<query>` would answer. */
export function queryDemoWorkers(query: string, rows: readonly DemoWorker[] = DEMO_WORKERS): DemoPage {
  const params = new URLSearchParams(query);
  let result = [...rows];
  const status = params.get('filter[status]');
  if (status) result = result.filter((w) => w.status === status);
  const division = params.get('filter[division]');
  if (division) result = result.filter((w) => w.division === division);
  const like = params.get('filter[name][like]')?.toLowerCase();
  if (like)
    result = result.filter(
      (w) => w.name.toLowerCase().startsWith(like) || w.code.toLowerCase().includes(like),
    );
  const sort = params.get('sort');
  if (sort) {
    const desc = sort.startsWith('-');
    const field = (desc ? sort.slice(1) : sort) as keyof DemoWorker;
    result.sort((a, b) => (desc ? -1 : 1) * compare(a, b, field));
  }
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const perPage = Number.parseInt(params.get('per_page') ?? '25', 10);
  return { data: result.slice((page - 1) * perPage, page * perPage), total: result.length };
}
