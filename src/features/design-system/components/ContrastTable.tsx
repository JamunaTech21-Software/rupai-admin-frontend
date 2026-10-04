import { contrastRatio, type ContrastPair } from '@/ui';

import { type TokenValues } from '../types';

interface ContrastTableProps {
  readonly pairs: readonly ContrastPair[];
  readonly values: TokenValues;
}

function ratioOf(pair: ContrastPair, values: TokenValues): number | null {
  const fg = values.get(pair.fg);
  const bg = values.get(pair.bg);
  if (!fg || !bg) return null;
  try {
    return contrastRatio(fg, bg);
  } catch {
    return null;
  }
}

/** Every colour pair the interface uses, measured live against its WCAG AA minimum. */
export function ContrastTable({ pairs, values }: ContrastTableProps) {
  const rows = pairs.map((pair) => ({ pair, ratio: ratioOf(pair, values) }));
  const measured = rows.filter((row) => row.ratio !== null);
  const passing = measured.filter((row) => (row.ratio ?? 0) >= row.pair.min);

  return (
    <div className="space-y-3">
      <p role="status" className="font-medium text-fg">
        {measured.length === 0 ? 'Measuring…' : `${passing.length} of ${pairs.length} pairs meet WCAG AA.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Contrast of every colour pair against its WCAG AA minimum</caption>
          <thead className="bg-surface-subtle text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Sample
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Pair
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Use
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Ratio
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Minimum
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ pair, ratio }) => {
              const pass = ratio !== null && ratio >= pair.min;
              return (
                <tr key={`${pair.fg}|${pair.bg}`}>
                  <td className="px-3 py-2">
                    {pair.min === 3 ? (
                      // A 3:1 pair is a border or focus ring, never text: show it as one.
                      <span
                        aria-hidden="true"
                        className="inline-flex size-8 rounded-md p-1"
                        style={{ backgroundColor: `var(${pair.bg})` }}
                      >
                        <span
                          className="size-full rounded-sm border-2"
                          style={{ borderColor: `var(${pair.fg})` }}
                        />
                      </span>
                    ) : (
                      <span
                        className="inline-flex rounded-sm border border-line px-2 py-0.5 font-semibold"
                        style={{ color: `var(${pair.fg})`, backgroundColor: `var(${pair.bg})` }}
                      >
                        Aa
                      </span>
                    )}
                  </td>
                  <th scope="row" className="px-3 py-2 font-mono font-normal text-fg">
                    {pair.fg} on {pair.bg}
                  </th>
                  <td className="px-3 py-2 text-fg-muted">{pair.use}</td>
                  <td className="px-3 py-2 text-right text-fg figures">
                    {ratio === null ? '—' : ratio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-fg-muted figures">{pair.min.toFixed(1)}</td>
                  <td className={`px-3 py-2 font-medium ${pass ? 'text-success' : 'text-danger'}`}>
                    {ratio === null ? '—' : pass ? '✓ Pass' : '✗ Fail'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
