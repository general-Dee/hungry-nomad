import { describe, it, expect } from 'vitest';
import { TAKEAWAY_FEE, requiresTakeawayFee, computeOrderTotal } from './pricing';
import { ProductCategory } from '@/types';

function items(...categories: ProductCategory[]) {
  return categories.map((category) => ({ category }));
}

describe('TAKEAWAY_FEE', () => {
  it('is the flat 300 fee', () => {
    expect(TAKEAWAY_FEE).toBe(300);
  });
});

describe('requiresTakeawayFee', () => {
  it('returns false for an empty cart', () => {
    expect(requiresTakeawayFee([])).toBe(false);
  });

  it('returns true when the only item is "regular"', () => {
    expect(requiresTakeawayFee(items('regular'))).toBe(true);
  });

  it('returns true when the only item is "chinese"', () => {
    expect(requiresTakeawayFee(items('chinese'))).toBe(true);
  });

  it('returns false when every item is a non-triggering category', () => {
    expect(requiresTakeawayFee(items('fast_food', 'icecream', 'beverages'))).toBe(false);
  });

  it('returns true for a mixed cart containing at least one triggering category', () => {
    expect(requiresTakeawayFee(items('fast_food', 'beverages', 'chinese'))).toBe(true);
  });

  it('returns true for a mixed cart with "regular" among non-triggering categories', () => {
    expect(requiresTakeawayFee(items('icecream', 'regular', 'beverages'))).toBe(true);
  });

  it('returns true when every item is a triggering category', () => {
    expect(requiresTakeawayFee(items('regular', 'chinese'))).toBe(true);
  });

  it('returns false for a single non-triggering item', () => {
    expect(requiresTakeawayFee(items('fast_food'))).toBe(false);
  });

  it('does not mutate the items array it is given', () => {
    const input = items('regular', 'fast_food');
    const snapshot = JSON.parse(JSON.stringify(input));
    requiresTakeawayFee(input);
    expect(input).toEqual(snapshot);
  });
});

// The server-derived total (subtotal + delivery fee + conditional takeaway
// fee) is computed by `computeOrderTotal` in this module and used directly by
// `POST /api/orders` (src/app/api/orders/route.ts), so it has one source of
// truth shared between the route and this test.
describe('computeOrderTotal (subtotal + delivery fee + takeaway fee)', () => {
  it('sums item price * quantity across multiple items plus delivery fee, no takeaway fee', () => {
    const orderItems = [
      { price_at_time: 1500, quantity: 2, category: 'fast_food' as ProductCategory },
      { price_at_time: 800, quantity: 3, category: 'beverages' as ProductCategory },
    ];
    // subtotal = 1500*2 + 800*3 = 3000 + 2400 = 5400
    expect(computeOrderTotal(orderItems, 500)).toEqual({ subtotal: 5400, takeawayFee: 0, total: 5400 + 500 });
  });

  it('adds the flat takeaway fee once when a triggering category is present, regardless of quantity', () => {
    const orderItems = [
      { price_at_time: 1000, quantity: 5, category: 'regular' as ProductCategory },
    ];
    // subtotal = 5000; + delivery 700 + takeaway 300
    expect(computeOrderTotal(orderItems, 700)).toEqual({
      subtotal: 5000,
      takeawayFee: TAKEAWAY_FEE,
      total: 5000 + 700 + TAKEAWAY_FEE,
    });
  });

  it('applies the takeaway fee only once for a cart with multiple triggering items', () => {
    const orderItems = [
      { price_at_time: 500, quantity: 1, category: 'regular' as ProductCategory },
      { price_at_time: 700, quantity: 1, category: 'chinese' as ProductCategory },
    ];
    // subtotal = 1200; takeaway fee applied once, not per triggering item
    expect(computeOrderTotal(orderItems, 0)).toEqual({ subtotal: 1200, takeawayFee: TAKEAWAY_FEE, total: 1200 + TAKEAWAY_FEE });
  });

  it('handles a zero-item order as zero subtotal plus delivery fee only', () => {
    expect(computeOrderTotal([], 500)).toEqual({ subtotal: 0, takeawayFee: 0, total: 500 });
  });
});
