import { describe, it, expect, afterEach } from 'vitest';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from './businessHours';

// WAT (Africa/Lagos) is a fixed UTC+1 offset with no DST, so every UTC
// instant below corresponds to WAT-time-minus-one-hour. Constructing these
// as explicit UTC instants (rather than `new Date(y, m, d, h, min)`, which
// is interpreted in the *local* machine timezone) is what makes these tests
// independent of the timezone the test runner happens to execute in.
function utcInstantForWatTime(hour: number, minute: number): Date {
  // e.g. WAT 11:00 -> UTC 10:00 on an arbitrary reference date.
  return new Date(Date.UTC(2026, 0, 15, hour - 1, minute, 0));
}

describe('isWithinBusinessHours', () => {
  it('is closed one minute before opening (10:59 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(10, 59))).toBe(false);
  });

  it('is open exactly at opening (11:00 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(11, 0))).toBe(true);
  });

  it('is open one minute after opening (11:01 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(11, 1))).toBe(true);
  });

  it('is open in the middle of the day (14:00 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(14, 0))).toBe(true);
  });

  it('is open one minute before closing (21:29 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(21, 29))).toBe(true);
  });

  it('is closed exactly at closing (21:30 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(21, 30))).toBe(false);
  });

  it('is closed one minute after closing (21:31 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(21, 31))).toBe(false);
  });

  it('is closed at midnight (00:00 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(0, 0))).toBe(false);
  });

  it('is closed late at night (23:59 WAT)', () => {
    expect(isWithinBusinessHours(utcInstantForWatTime(23, 59))).toBe(false);
  });

  it('defaults to the current time when no date is passed, without throwing', () => {
    expect(() => isWithinBusinessHours()).not.toThrow();
  });

  it('exposes a label matching the configured open/close boundary', () => {
    expect(BUSINESS_HOURS_LABEL).toBe('11:00am – 9:30pm');
  });

  describe('timezone independence of the machine running the test', () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    // The implementation always passes an explicit `timeZone: 'Africa/Lagos'`
    // to Intl.DateTimeFormat, so the *host* machine/test-runner timezone
    // (process.env.TZ) must have no effect on the result for the same UTC
    // instant.
    const zonesToTry = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'];

    it.each(zonesToTry)('opening boundary (11:00 WAT) is open under host TZ=%s', (tz) => {
      process.env.TZ = tz;
      expect(isWithinBusinessHours(utcInstantForWatTime(11, 0))).toBe(true);
    });

    it.each(zonesToTry)('closing boundary (21:30 WAT) is closed under host TZ=%s', (tz) => {
      process.env.TZ = tz;
      expect(isWithinBusinessHours(utcInstantForWatTime(21, 30))).toBe(false);
    });
  });
});
