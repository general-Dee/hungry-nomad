import { describe, it, expect } from 'vitest';
import {
  isValidOrderStatus,
  canTransition,
  validateTransition,
  ORDER_STATUSES,
  OrderStatus,
} from './orderStatus';

describe('isValidOrderStatus', () => {
  it.each(ORDER_STATUSES)('accepts the known status "%s"', (status) => {
    expect(isValidOrderStatus(status)).toBe(true);
  });

  it('rejects an unknown string', () => {
    expect(isValidOrderStatus('shipped')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidOrderStatus('')).toBe(false);
  });

  it('rejects non-string values: number', () => {
    expect(isValidOrderStatus(1)).toBe(false);
  });

  it('rejects non-string values: null', () => {
    expect(isValidOrderStatus(null)).toBe(false);
  });

  it('rejects non-string values: undefined', () => {
    expect(isValidOrderStatus(undefined)).toBe(false);
  });

  it('rejects non-string values: object', () => {
    expect(isValidOrderStatus({ status: 'paid' })).toBe(false);
  });

  it('rejects non-string values: array', () => {
    expect(isValidOrderStatus(['paid'])).toBe(false);
  });

  it('is case-sensitive (rejects "Paid")', () => {
    expect(isValidOrderStatus('Paid')).toBe(false);
  });
});

describe('canTransition — allowed transitions', () => {
  it('allows pending -> paid', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
  });

  it('allows pending -> failed', () => {
    expect(canTransition('pending', 'failed')).toBe(true);
  });

  it('allows paid -> delivered', () => {
    expect(canTransition('paid', 'delivered')).toBe(true);
  });

  it('allows paid -> failed', () => {
    expect(canTransition('paid', 'failed')).toBe(true);
  });
});

describe('canTransition — rejected transitions', () => {
  const rejectedCases: [OrderStatus, OrderStatus][] = [
    // same-status "transitions" (no-ops) are rejected
    ['pending', 'pending'],
    ['paid', 'paid'],
    ['delivered', 'delivered'],
    ['failed', 'failed'],
    // terminal statuses have no outgoing transitions
    ['delivered', 'pending'],
    ['delivered', 'paid'],
    ['delivered', 'failed'],
    ['failed', 'pending'],
    ['failed', 'paid'],
    ['failed', 'delivered'],
    // unlisted / backwards / skip-ahead transitions
    ['pending', 'delivered'],
    ['paid', 'pending'],
  ];

  it.each(rejectedCases)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('validateTransition', () => {
  it('returns ok:true for a valid transition', () => {
    expect(validateTransition('pending', 'paid')).toEqual({ ok: true });
  });

  it('returns ok:false with an error message for an invalid target status', () => {
    const result = validateTransition('pending', 'shipped' as OrderStatus);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid status/);
      expect(result.error).toContain('shipped');
    }
  });

  it('returns ok:false with an error message for a disallowed transition between valid statuses', () => {
    const result = validateTransition('delivered', 'pending');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Cannot transition/);
      expect(result.error).toContain('delivered');
      expect(result.error).toContain('pending');
    }
  });

  it('returns ok:false for a same-status transition', () => {
    const result = validateTransition('paid', 'paid');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for failed -> paid (rejected even though both are valid statuses)', () => {
    const result = validateTransition('failed', 'paid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Cannot transition/);
    }
  });
});
