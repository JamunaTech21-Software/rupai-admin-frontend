import { type BadgeTone } from '@/ui';

import { type RequestState } from '../api/approvals';

/** The badge colour of an approval's state: pending reads as submitted, returned as a warning. */
export function stateTone(state: RequestState): BadgeTone {
  if (state === 'pending') return 'submitted';
  if (state === 'returned') return 'warning';
  return state;
}
