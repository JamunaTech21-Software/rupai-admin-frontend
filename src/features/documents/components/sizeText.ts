/** "2.4 MB", "820 KB": a file's size for display only (not a quantity of anything the books count). */
export function sizeText(bytes: number): string {
  const MB = 1024 * 1024;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${String(bytes)} B`;
}
