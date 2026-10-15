import { useTranslation } from '@/lib/i18n';

import { type Condition, type DocumentType } from '../api/workflows';
import { conditionValue, fieldLabel } from './draft';

/** A condition in words: "Total amount is at least 300,000.00". */
export function ConditionText({
  condition,
  documentType,
}: {
  readonly condition: Condition;
  readonly documentType: DocumentType | undefined;
}) {
  const { t } = useTranslation('workflows');
  const value = conditionValue(condition, t('condition.and'));
  return (
    <span>
      {fieldLabel(documentType, condition.field)} {t(`operators.${condition.operator}`)}
      {value === '' ? '' : ` ${value}`}
    </span>
  );
}
