// @vitest-environment jsdom
//
// attribution.ts is a plain localStorage helper (no React), but it's
// guarded by `typeof window === 'undefined'` and needs a real
// `localStorage`/`window.location`, so this file opts into the jsdom
// environment even though it's a plain .test.ts (vitest.config.ts only
// auto-selects jsdom for .test.tsx files) — same pattern as
// recentOrders.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureAttributionFromUrl, getStoredAttribution } from './attribution';

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('captureAttributionFromUrl', () => {
  beforeEach(() => {
    setSearch('');
  });

  it('does not write to localStorage when no attribution params are present', () => {
    setSearch('?foo=bar');
    captureAttributionFromUrl();
    expect(localStorage.getItem('attribution')).toBeNull();
  });

  it('captures all six recognized params plus a captured_at timestamp', () => {
    setSearch(
      '?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_content=ad1&utm_term=jollof&fbclid=abc123'
    );
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    captureAttributionFromUrl();

    expect(getStoredAttribution()).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'summer',
      utm_content: 'ad1',
      utm_term: 'jollof',
      fbclid: 'abc123',
      captured_at: now,
    });
  });

  it('captures a partial set of params, omitting the ones not present in the URL', () => {
    setSearch('?utm_source=facebook&fbclid=xyz');
    captureAttributionFromUrl();

    const stored = getStoredAttribution();
    expect(stored).toMatchObject({ utm_source: 'facebook', fbclid: 'xyz' });
    expect(stored?.utm_medium).toBeUndefined();
    expect(stored?.utm_campaign).toBeUndefined();
  });

  it('ignores unrelated query params', () => {
    setSearch('?ref=newsletter&utm_source=google');
    captureAttributionFromUrl();

    const stored = getStoredAttribution();
    expect(stored).toEqual({ utm_source: 'google', captured_at: expect.any(Number) });
    expect((stored as Record<string, unknown>)?.ref).toBeUndefined();
  });

  it('last-click: overwrites a previously stored attribution rather than merging with it', () => {
    setSearch('?utm_source=google&utm_medium=cpc');
    captureAttributionFromUrl();
    expect(getStoredAttribution()?.utm_source).toBe('google');

    setSearch('?utm_source=facebook');
    captureAttributionFromUrl();

    const stored = getStoredAttribution();
    expect(stored?.utm_source).toBe('facebook');
    // utm_medium from the first visit must not survive into the new capture
    // — this is a full overwrite, not a field-by-field merge.
    expect(stored?.utm_medium).toBeUndefined();
  });

  it('does not overwrite a previously stored attribution when a later navigation carries no attribution params', () => {
    setSearch('?utm_source=google');
    captureAttributionFromUrl();

    setSearch('?foo=bar');
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.utm_source).toBe('google');
  });

  it('treats an empty-string param value as not present', () => {
    setSearch('?utm_source=&utm_medium=cpc');
    captureAttributionFromUrl();

    const stored = getStoredAttribution();
    expect(stored?.utm_source).toBeUndefined();
    expect(stored?.utm_medium).toBe('cpc');
  });

  it('does not throw when localStorage.setItem throws (e.g. quota exceeded / Safari private mode)', () => {
    setSearch('?utm_source=google');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => captureAttributionFromUrl()).not.toThrow();

    setItemSpy.mockRestore();
  });
});

describe('getStoredAttribution', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredAttribution()).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('attribution', '{not valid json');
    expect(getStoredAttribution()).toBeNull();
  });

  it('returns null when the stored value is not an object (e.g. a JSON array or primitive)', () => {
    localStorage.setItem('attribution', JSON.stringify(['not', 'an', 'object']));
    expect(getStoredAttribution()).toBeNull();

    localStorage.setItem('attribution', JSON.stringify('just a string'));
    expect(getStoredAttribution()).toBeNull();
  });

  it('returns null when the stored value is JSON null', () => {
    localStorage.setItem('attribution', JSON.stringify(null));
    expect(getStoredAttribution()).toBeNull();
  });

  it('returns the parsed object as-is when it is valid JSON', () => {
    const value = { utm_source: 'google', captured_at: 123 };
    localStorage.setItem('attribution', JSON.stringify(value));
    expect(getStoredAttribution()).toEqual(value);
  });

  it('drops individual fields that are not strings instead of failing the whole read', () => {
    // Simulates a corrupted/tampered localStorage value (e.g. a browser
    // extension writing a non-string into one of these keys) — this must
    // never block the rest of a legitimate attribution read.
    localStorage.setItem(
      'attribution',
      JSON.stringify({
        utm_source: 'google',
        utm_medium: 12345,
        utm_campaign: { nested: true },
        utm_content: ['array', 'value'],
        utm_term: null,
        fbclid: 'abc123',
        captured_at: 1700000000000,
      })
    );

    expect(getStoredAttribution()).toEqual({
      utm_source: 'google',
      fbclid: 'abc123',
      captured_at: 1700000000000,
    });
  });

  it('returns an object with only captured_at when every attribution field is invalid', () => {
    localStorage.setItem(
      'attribution',
      JSON.stringify({ utm_source: 42, utm_medium: false, captured_at: 123 })
    );

    expect(getStoredAttribution()).toEqual({ captured_at: 123 });
  });

  it('drops captured_at when it is not a number', () => {
    localStorage.setItem(
      'attribution',
      JSON.stringify({ utm_source: 'google', captured_at: 'not-a-number' })
    );

    expect(getStoredAttribution()).toEqual({ utm_source: 'google' });
  });
});
