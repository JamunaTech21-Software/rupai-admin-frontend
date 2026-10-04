import { type Token } from '@/ui';

import { type TokenValues } from '../types';

import { displayValue } from './useTokenValues';

interface TokenTableProps {
  readonly caption: string;
  readonly tokens: readonly Token[];
  readonly values: TokenValues;
}

/** Name, live value and purpose of each token. */
export function TokenTable({ caption, tokens, values }: TokenTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-subtle text-fg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Token
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Use
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tokens.map((token) => (
            <tr key={token.name}>
              <th scope="row" className="px-3 py-2 font-mono font-normal whitespace-nowrap text-fg">
                {token.name}
              </th>
              <td className="px-3 py-2 font-mono text-fg-muted">{displayValue(values, token.name)}</td>
              <td className="px-3 py-2 text-fg-muted">{token.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
