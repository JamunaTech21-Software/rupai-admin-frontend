import { QuantityInput, type QuantityInputProps } from '@/ui';

import { useArea } from '../area';

/** An area in acres, to 3 decimal places ("12.500 acres"), as the backend stores it (DECIMAL(14,3)). */
export function AreaInput(props: Omit<QuantityInputProps, 'unit' | 'unitName'>) {
  const area = useArea();
  return <QuantityInput {...props} unit={area.unit} unitName={area.unitName} />;
}
