const SOON_DAYS = 30;

/** Today and a date `days` ahead as YYYY-MM-DD, in the estate's timezone (Dhaka, no daylight saving). */
function dhakaDate(days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

/** "expired" before today, "expiring" within 30 days, "valid" after that, null when no expiry is recorded. */
export function licenceState(expiry: string | null): 'expired' | 'expiring' | 'valid' | null {
  if (!expiry) return null;
  if (expiry < dhakaDate()) return 'expired';
  if (expiry <= dhakaDate(SOON_DAYS)) return 'expiring';
  return 'valid';
}
