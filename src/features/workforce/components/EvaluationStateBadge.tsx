import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone } from '@/ui';

import type { Evaluation } from '../api/performance';

const STATE_TONES: Record<Evaluation['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  rejected: 'danger',
  acknowledged: 'success',
};

const RATING_TONES: Record<NonNullable<Evaluation['overall_rating']>, BadgeTone> = {
  outstanding: 'success',
  exceeds: 'success',
  meets: 'info',
  needs_improvement: 'warning',
  unsatisfactory: 'danger',
};

/** Draft / Waiting for approval / Approved / Rejected / Acknowledged. */
export function EvaluationStateBadge({ state }: { readonly state: Evaluation['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={STATE_TONES[state]} label={t(`evaluationStates.${state}`)} />;
}

/** The rating the backend worked out from the scores: shown, never edited. */
export function RatingBadge({ rating }: { readonly rating: Evaluation['overall_rating'] }) {
  const { t } = useTranslation('workforce');
  if (rating === null) return <span className="text-fg-subtle">—</span>;
  return <Badge tone={RATING_TONES[rating]} label={t(`ratings.${rating}`)} />;
}
