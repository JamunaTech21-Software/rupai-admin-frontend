import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone } from '@/ui';

import { type FiscalYearState, type PeriodState, type SeasonState } from '../api/schemas';

const SEASON_TONE: Record<SeasonState, BadgeTone> = { planned: 'info', active: 'success', closed: 'neutral' };
const YEAR_TONE: Record<FiscalYearState, BadgeTone> = { future: 'info', open: 'success', closed: 'neutral' };
const PERIOD_TONE: Record<PeriodState, BadgeTone> = {
  future: 'info',
  open: 'success',
  soft_closed: 'warning',
  closed: 'neutral',
  reopened: 'warning',
};

/** Planned / Active / Closed. */
export function SeasonStateBadge({ state }: { readonly state: SeasonState }) {
  const { t } = useTranslation('org');
  return <Badge tone={SEASON_TONE[state]} label={t(`seasonState.${state}`)} />;
}

/** Future / Open / Closed. */
export function FiscalYearStateBadge({ state }: { readonly state: FiscalYearState }) {
  const { t } = useTranslation('org');
  return <Badge tone={YEAR_TONE[state]} label={t(`fiscalYearState.${state}`)} />;
}

/** Future / Open (soft closed, closed and reopened arrive with period close). */
export function PeriodStateBadge({ state }: { readonly state: PeriodState }) {
  const { t } = useTranslation('org');
  return <Badge tone={PERIOD_TONE[state]} label={t(`periodState.${state}`)} />;
}
