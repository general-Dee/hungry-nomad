// @vitest-environment jsdom
//
// recentOrders.ts is a plain localStorage helper (no React), but it's
// guarded by `typeof window === 'undefined'` and needs a real
// `localStorage`, so this file opts into the jsdom environment even though
// it's a plain .test.ts (vitest.config.ts only auto-selects jsdom for
// .test.tsx files).

import { describe, it, expect } from 'vitest';
import { getRecentOrders, addRecentOrder } from './recentOrders';

describe('getRecentOrders', () => {
  it('returns [] when nothing is stored', () => {
    expect(getRecentOrders()).toEqual([]);
  });

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem('recentOrders', '{not valid json');
    expect(getRecentOrders()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', () => {
    localStorage.setItem('recentOrders', JSON.stringify({ id: 1, phone: '08012345678' }));
    expect(getRecentOrders()).toEqual([]);
  });

  it('filters out malformed entries (missing/wrong-typed id or phone)', () => {
    localStorage.setItem(
      'recentOrders',
      JSON.stringify([
        { id: 1, phone: '08012345678' },
        { id: 'not-a-number', phone: '08012345678' },
        { id: 2 },
        { phone: '08099999999' },
        null,
        { id: 3, phone: '08033333333' },
      ])
    );
    expect(getRecentOrders()).toEqual([
      { id: 1, phone: '08012345678' },
      { id: 3, phone: '08033333333' },
    ]);
  });
});

describe('addRecentOrder', () => {
  it('adds a new entry to the front', () => {
    addRecentOrder({ id: 1, phone: '08012345678' });
    addRecentOrder({ id: 2, phone: '08099999999' });
    expect(getRecentOrders()).toEqual([
      { id: 2, phone: '08099999999' },
      { id: 1, phone: '08012345678' },
    ]);
  });

  it('re-adding an existing id moves it to the front rather than duplicating it', () => {
    addRecentOrder({ id: 1, phone: '08012345678' });
    addRecentOrder({ id: 2, phone: '08099999999' });
    addRecentOrder({ id: 3, phone: '08033333333' });
    // id 1 comes back around (e.g. phone updated) — should move to front, not duplicate
    addRecentOrder({ id: 1, phone: '08012340000' });

    const orders = getRecentOrders();
    expect(orders).toEqual([
      { id: 1, phone: '08012340000' },
      { id: 3, phone: '08033333333' },
      { id: 2, phone: '08099999999' },
    ]);
    expect(orders).toHaveLength(3);
  });

  it('adding a 6th distinct entry drops the oldest, keeping the cap at 5 most-recent-first', () => {
    for (let i = 1; i <= 5; i++) {
      addRecentOrder({ id: i, phone: `0801234000${i}` });
    }
    // Oldest so far is id 1 (added first). Adding a 6th distinct entry should drop it.
    addRecentOrder({ id: 6, phone: '08012349999' });

    const orders = getRecentOrders();
    expect(orders).toHaveLength(5);
    expect(orders.map((o) => o.id)).toEqual([6, 5, 4, 3, 2]);
    expect(orders.find((o) => o.id === 1)).toBeUndefined();
  });
});
