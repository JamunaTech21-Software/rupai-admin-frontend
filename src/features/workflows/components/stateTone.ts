import { type BadgeTone } from '@/ui';

import { type WorkflowState } from '../api/workflows';

/** The badge colour of a workflow version's state. */
export function stateTone(state: WorkflowState): BadgeTone {
  if (state === 'active') return 'approved';
  if (state === 'superseded') return 'cancelled';
  return state;
}
