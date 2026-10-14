import { type NumberFormatInput } from './api/numbering';

/**
 * How a number is built, as the server builds it (backend core/numbering: numberParts, renderNumber), so the
 * edit form can show the effect of a change before it is saved. The list shows the server's own example.
 *
 *   prefix · estate · fiscal year · season · reset period · sequence, joined by the separator
 */

/** The sample codes the server uses for its examples. */
export const SAMPLE = { estate: 'EST', fiscalYear: 'FY2026-27', season: '2026-27' } as const;

export function exampleNumber(format: NumberFormatInput, today: string, sequence = 1): string {
  const segments: string[] = [format.prefix];
  if (format.include_estate_code) segments.push(SAMPLE.estate);
  if (format.include_fiscal_year) segments.push(SAMPLE.fiscalYear);
  if (format.include_season) segments.push(SAMPLE.season);
  const [year = '', month = ''] = today.split('-');
  if (format.reset_frequency === 'monthly') segments.push(`${year}${month}`);
  // A fiscal year or season in the number already restarts it each year.
  else if (format.reset_frequency === 'yearly' && !format.include_fiscal_year && !format.include_season)
    segments.push(year);
  const width = Math.min(Math.max(format.sequence_width, 1), 12);
  return [...segments, String(sequence).padStart(width, '0')].join(format.separator);
}

export type ScopePart =
  | { readonly kind: 'estate' | 'fiscal_year' | 'season' | 'year' | 'month'; readonly value: string }
  | { readonly kind: 'all' };

const SCOPE_KINDS = { E: 'estate', FY: 'fiscal_year', S: 'season', Y: 'year', M: 'month' } as const;

/** A counter's scope key ("E:EST|FY:FY2026-27", "M:2026-10", "*") as parts to label. */
export function scopeParts(scopeKey: string): ScopePart[] {
  if (scopeKey === '*' || scopeKey === '') return [{ kind: 'all' }];
  return scopeKey.split('|').flatMap((part): ScopePart[] => {
    const colon = part.indexOf(':');
    const kind = SCOPE_KINDS[part.slice(0, colon) as keyof typeof SCOPE_KINDS] as
      (typeof SCOPE_KINDS)[keyof typeof SCOPE_KINDS] | undefined;
    return colon > 0 && kind ? [{ kind, value: part.slice(colon + 1) }] : [];
  });
}
