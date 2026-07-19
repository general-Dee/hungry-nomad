const TIMEZONE = 'Africa/Lagos'; // WAT (UTC+1), no DST

const OPEN_MINUTES = 11 * 60; // 11:00am
const CLOSE_MINUTES = 21 * 60 + 30; // 9:30pm

export const BUSINESS_HOURS_LABEL = '11:00am – 9:30pm';

export function isWithinBusinessHours(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const minutesSinceMidnight = hour * 60 + minute;

  return minutesSinceMidnight >= OPEN_MINUTES && minutesSinceMidnight < CLOSE_MINUTES;
}
