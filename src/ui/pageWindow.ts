/** Page numbers to show: always the first and last, the current one and its neighbours, gaps as null. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((p, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && p - previous > 1) result.push(null);
    result.push(p);
  });
  return result;
}
