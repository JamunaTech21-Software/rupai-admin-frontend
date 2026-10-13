import { type BadgeTone } from '@/ui';

import { type FiscalYearState, type SeasonState } from './api/schemas';

/** The page-header badge tone of a season or fiscal year state (same colours as the list badges). */
export const seasonTone = (state: SeasonState): BadgeTone =>
  state === 'active' ? 'success' : state === 'planned' ? 'info' : 'neutral';
export const fiscalYearTone = (state: FiscalYearState): BadgeTone =>
  state === 'open' ? 'success' : state === 'future' ? 'info' : 'neutral';
