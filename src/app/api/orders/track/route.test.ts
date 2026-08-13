import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// POST /api/orders/track has two very different failure modes for the orders
// lookup that must never be conflated:
//   - a genuine "no such order" (PostgREST's PGRST116 from .single(), i.e.
//     the query succeeded and simply found no row) — a normal, expected
//     outcome for a customer typo — must return 404 with the existing
//     "No matching order found..." message.
//   - a real connectivity failure that exhausts withRetry's attempts must
//     return 503 with the new "Order lookup is temporarily unavailable..."
//     message, and must NOT be reported to the user as "order not found"
//     (that would be misleading — the order may well exist).

const { mockFrom, setOrdersResult, setItemsResult } = vi.hoisted(() => {
  // Placeholder default, overridden in every test's beforeEach — kept free
  // of any reference to the module-level ORDER const (declared further
  // down, after the mocked imports) since vi.hoisted's callback runs before
  // that declaration exists.
  let ordersResult: { data: unknown; error: unknown } = { data: null, error: null };
  let itemsResult: { data: unknown; error: unknown } = { data: [], error: null };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        select: () => ({
          eq: () => ({
            abortSignal: () => ({
              single: () => Promise.resolve(ordersResult),
            }),
          }),
        }),
      };
    }
    if (table === 'order_items') {
      return {
        select: () => ({
          eq: () => ({ abortSignal: () => Promise.resolve(itemsResult) }),
        }),
      };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return {
    mockFrom,
    setOrdersResult: (result: { data: unknown; error: unknown }) => {
      ordersResult = result;
    },
    setItemsResult: (result: { data: unknown; error: unknown }) => {
      itemsResult = result;
    },
  };
});

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mockFrom },
}));

// No UPSTASH_REDIS_REST_URL / TOKEN are set in the test env, so the real
// ratelimit module resolves orderTrackRatelimit to null and POST skips rate
// limiting entirely — no need to mock it separately.

import { POST } from './route';

const ORDER = {
  id: 42,
  customer_phone: '08012345678',
  customer_address: '1 Test Street',
  delivery_lga: 'Ikeja',
  total_amount: 1500,
  status: 'pending',
  created_at: '2026-08-01T10:00:00.000Z',
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/orders/track', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const ORDER_ID = ORDER.id;
const CORRECT_PHONE = ORDER.customer_phone;

describe('POST /api/orders/track', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    setOrdersResult({ data: ORDER, error: null });
    setItemsResult({ data: [], error: null });
  });

  it('returns 404 "No matching order found..." when the order genuinely does not exist (PGRST116)', async () => {
    setOrdersResult({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });

    const res = await POST(makeRequest({ order_id: 999, phone: CORRECT_PHONE }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'No matching order found. Check your order ID and phone number.',
    });
  });

  it('returns 404 when the order exists but the phone number does not match', async () => {
    const res = await POST(makeRequest({ order_id: ORDER_ID, phone: '08099999999' }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'No matching order found. Check your order ID and phone number.',
    });
  });

  it('returns 503 "Order lookup is temporarily unavailable..." when the lookup exhausts retries on a connectivity failure', async () => {
    setOrdersResult({ data: null, error: { code: 'ETIMEDOUT', message: 'connection reset' } });

    const res = await POST(makeRequest({ order_id: ORDER_ID, phone: CORRECT_PHONE }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'Order lookup is temporarily unavailable. Please try again shortly.',
    });
  });

  it('does not conflate a connectivity failure (503) with a not-found result (404)', async () => {
    setOrdersResult({ data: null, error: { code: 'ETIMEDOUT', message: 'connection reset' } });
    const failureRes = await POST(makeRequest({ order_id: ORDER_ID, phone: CORRECT_PHONE }));

    setOrdersResult({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });
    const notFoundRes = await POST(makeRequest({ order_id: 999, phone: CORRECT_PHONE }));

    expect(failureRes.status).toBe(503);
    expect(notFoundRes.status).toBe(404);
    expect(await failureRes.json()).not.toEqual(await notFoundRes.json());
  });

  it('returns 200 with order details when the order exists and the phone number matches', async () => {
    const res = await POST(makeRequest({ order_id: ORDER_ID, phone: CORRECT_PHONE }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ORDER.id);
    expect(body.status).toBe(ORDER.status);
  });

  it('returns 400 when order_id or phone is missing, without querying the database', async () => {
    const res = await POST(makeRequest({ order_id: '', phone: CORRECT_PHONE }));

    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
