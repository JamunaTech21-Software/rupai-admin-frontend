/**
 * Up to two initials from a name, split by grapheme so Bengali conjuncts and combining marks stay whole
 * ("রহিম উদ্দিন" → "রউ", not a broken half-letter).
 */
export function initialsOf(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (word: string) => segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? '';
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return picked
    .map((word) => first(word ?? ''))
    .join('')
    .toLocaleUpperCase();
}
