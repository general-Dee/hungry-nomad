// @vitest-environment jsdom
//
// deliveryZoneCache.ts is a plain localStorage helper (no React), but it's
// guarded by `typeof window === 'undefined'` and needs a real
// `localStorage`, so this file opts into the jsdom environment even though
// it's a plain .test.ts (vitest.config.ts only auto-selects jsdom for
// .test.tsx files).

import { describe, it, expect } from 'vitest';
import { getCachedDeliveryZones, setCachedDeliveryZones } from './deliveryZoneCache';

describe('getCachedDeliveryZones', () => {
  it('returns [] when nothing is stored', () => {
    expect(getCachedDeliveryZones()).toEqual([]);
  });

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem('cachedDeliveryZones', '{not valid json');
    expect(getCachedDeliveryZones()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', () => {
    localStorage.setItem('cachedDeliveryZones', JSON.stringify({ id: 1, lga_name: 'Ikeja', fee: 1000 }));
    expect(getCachedDeliveryZones()).toEqual([]);
  });

  it('filters out malformed entries (missing/wrong-typed id, lga_name, or fee)', () => {
    localStorage.setItem(
      'cachedDeliveryZones',
      JSON.stringify([
        { id: 1, lga_name: 'Ikeja', fee: 1000 },
        { id: 'not-a-number', lga_name: 'Surulere', fee: 1500 },
        { id: 2, lga_name: 'Yaba' },
        { id: 3, fee: 2000 },
        null,
        { id: 4, lga_name: 'Lekki', fee: 2500 },
      ])
    );
    expect(getCachedDeliveryZones()).toEqual([
      { id: 1, lga_name: 'Ikeja', fee: 1000 },
      { id: 4, lga_name: 'Lekki', fee: 2500 },
    ]);
  });
});

describe('setCachedDeliveryZones', () => {
  it('writes zones that can then be read back', () => {
    const zones = [
      { id: 1, lga_name: 'Ikeja', fee: 1000 },
      { id: 2, lga_name: 'Surulere', fee: 1500 },
    ];
    setCachedDeliveryZones(zones);
    expect(getCachedDeliveryZones()).toEqual(zones);
  });

  it('overwrites any previously cached zones', () => {
    setCachedDeliveryZones([{ id: 1, lga_name: 'Ikeja', fee: 1000 }]);
    setCachedDeliveryZones([{ id: 2, lga_name: 'Surulere', fee: 1500 }]);
    expect(getCachedDeliveryZones()).toEqual([{ id: 2, lga_name: 'Surulere', fee: 1500 }]);
  });

  it('does not throw when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => setCachedDeliveryZones([{ id: 1, lga_name: 'Ikeja', fee: 1000 }])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
