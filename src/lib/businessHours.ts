const TIMEZONE = 'Africa/Lagos'; // WAT (UTC+1), no DST

export const DEFAULT_OPEN_MINUTES = 11 * 60; // 11:00am
export const DEFAULT_CLOSE_MINUTES = 21 * 60 + 30; // 9:30pm

export const BUSINESS_HOURS_LABEL = '11:00am – 9:30pm';

export interface StoreHours {
  openMinutes: number;
  closeMinutes: number;
  closedOverride: boolean;
  label: string;
}

export function isWithinBusinessHours(date: Date = new Date(), hours?: StoreHours): boolean {
  if (hours?.closedOverride) return false;
  const openMinutes = hours?.openMinutes ?? DEFAULT_OPEN_MINUTES;
  const closeMinutes = hours?.closeMinutes ?? DEFAULT_CLOSE_MINUTES;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const minutesSinceMidnight = hour * 60 + minute;

  return minutesSinceMidnight >= openMinutes && minutesSinceMidnight < closeMinutes;
}
