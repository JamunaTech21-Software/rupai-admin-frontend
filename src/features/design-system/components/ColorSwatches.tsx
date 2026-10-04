import { type TokenGroup } from '@/ui';

import { type TokenValues } from '../types';

import { displayValue } from './useTokenValues';

interface ColorSwatchesProps {
  readonly group: TokenGroup;
  readonly values: TokenValues;
}

export function ColorSwatches({ group, values }: ColorSwatchesProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-fg">{group.title}</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tokens.map((token) => (
          <li key={token.name} className="flex items-center gap-3 rounded-md border border-line p-2">
            <span
              aria-hidden="true"
              className="size-12 shrink-0 rounded-md border border-line"
              style={{ backgroundColor: `var(${token.name})` }}
            />
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm text-fg">{token.name}</span>
              <span className="block font-mono text-sm text-fg-muted">
                {displayValue(values, token.name)}
              </span>
              <span className="block text-sm text-fg-subtle">{token.use}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
