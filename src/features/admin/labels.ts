/** `bank_account` → `Bank account`. Module keys are data from the catalogue, shown as written. */
export function moduleLabel(module: string): string {
  const text = module.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const DHAKA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The estate's calendar date of an instant: `2026-10-04T19:30:00Z` → `2026-10-05` (Dhaka). */
export function dhakaDate(iso: string): string {
  return DHAKA_DATE.format(new Date(iso));
}

/**
 * A role expiry chosen as a date means "through that whole day" in the estate's timezone: the last second of
 * the day in Dhaka, as the ISO timestamp with offset the API requires.
 */
export function endOfDhakaDay(businessDate: string): string {
  return `${businessDate}T23:59:59+06:00`;
}
