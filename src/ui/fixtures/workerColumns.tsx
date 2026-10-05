import { formatBusinessDate } from '@/lib/dates';
import { formatDecimal } from '@/lib/money';

import { Badge } from '../Badge';
import { type DataColumn } from '../DataTable';

import { type DemoWorker } from './workers';

/** The demo Workers table's columns. */
export const WORKER_COLUMNS: readonly DataColumn<DemoWorker>[] = [
  { id: 'name', header: 'Name', isSortable: true, cell: (w) => w.name },
  { id: 'code', header: 'Code', isSortable: true, cell: (w) => w.code },
  { id: 'division', header: 'Division', cell: (w) => w.division },
  {
    id: 'status',
    header: 'Status',
    cell: (w) =>
      w.status === 'active' ? (
        <Badge tone="success" label="Active" />
      ) : (
        <Badge tone="neutral" label="Disabled" />
      ),
  },
  {
    id: 'leaf_kg',
    header: 'Leaf (kg)',
    isNumeric: true,
    isSortable: true,
    cell: (w) => formatDecimal(w.leaf_kg, { minScale: 3 }),
  },
  {
    id: 'joined_on',
    header: 'Joined',
    isSortable: true,
    isHiddenByDefault: true,
    cell: (w) => formatBusinessDate(w.joined_on),
  },
];
