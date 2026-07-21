import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// `orders.id` is a small sequential integer, so GET /api/orders/[id] must
// never let a caller distinguish "no such order" from "wrong reference" via
// status code (that would let the id space be enumerated). These tests pin
// that behavior down: every failure path below must return 404 with the same
// generic body, and the DB must never even be queried when the reference is
// missing outright.

const { mockFrom, setOrdersResult, setItemsResult } = vi.hoisted(() => {
  let ordersResult: { data: unknown; error: unknown } = { data: null, error: null };
  let itemsResult: { data: unknown; error: unknown } = { data: [], error: null };

  function makeAwaitableQuery(result: { data: unknown; error: unknown }) {
    // Mimics supabase-js's PostgrestFilterBuilder: awaitable directly (used
    // by the order_items query) and also exposes `.single()` (used by the
    // orders query).
    return {
      single: () => Promise.resolve(result),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
  }

  const mockFrom = vi.fn((table: string) => {
    if (table === 'orders') {
      return { select: () => ({ eq: () => makeAwaitableQuery(ordersResult) }) };
    }
    if (table === 'order_items') {
      return { select: () => ({ eq: () => makeAwaitableQuery(itemsResult) }) };
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

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

// No UPSTASH_REDIS_REST_URL / TOKEN are set in the test env, so the real
// ratelimit module resolves orderGetRatelimit to null and GET skips rate
// limiting entirely — no need to mock it separately.

import { GET } from './route';

const EXISTING_ORDER = {
  id: 5,
  customer_name: 'Ada',
  payment_reference: 'ref-correct-123',
  status: 'paid',
};

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe('GET /api/orders/[id]', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    setOrdersResult({ data: EXISTING_ORDER, error: null });
    setItemsResult({ data: [], error: null });
  });

  it('returns 404 without querying the database when reference is missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/orders/5'), {
      params: { id: '5' },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Order not found' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 when reference is an empty string', async () => {
    const res = await GET(makeRequest('http://localhost/api/orders/5?reference='), {
      params: { id: '5' },
    });

    expect(res.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist', async () => {
    setOrdersResult({ data: null, error: { message: 'not found' } });

    const res = await GET(makeRequest('http://localhost/api/orders/999?reference=anything'), {
      params: { id: '999' },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Order not found' });
  });

  it('returns 404 (not a different status) when the order exists but the reference does not match', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/orders/5?reference=wrong-reference'),
      { params: { id: '5' } }
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Order not found' });
  });

  it('returns the same 404 status and body for "no such order" and "wrong reference" cases', async () => {
    const noSuchOrderRes = await GET(
      makeRequest('http://localhost/api/orders/999?reference=anything'),
      { params: { id: '999' } }
    );
    setOrdersResult({ data: EXISTING_ORDER, error: null });
    const wrongReferenceRes = await GET(
      makeRequest('http://localhost/api/orders/5?reference=wrong-reference'),
      { params: { id: '5' } }
    );

    expect(noSuchOrderRes.status).toBe(wrongReferenceRes.status);
    expect(await noSuchOrderRes.json()).toEqual(await wrongReferenceRes.json());
  });

  it('returns 200 with the order and items when the reference matches', async () => {
    setItemsResult({
      data: [
        { product_id: 1, quantity: 2, price_at_time: 1000, products: [{ name: 'Jollof Rice' }] },
      ],
      error: null,
    });

    const res = await GET(
      makeRequest(`http://localhost/api/orders/5?reference=${EXISTING_ORDER.payment_reference}`),
      { params: { id: '5' } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(EXISTING_ORDER.id);
    expect(body.items).toEqual([
      { product_id: 1, product_name: 'Jollof Rice', quantity: 2, price_at_time: 1000 },
    ]);
  });

  it('returns 500 when fetching order items fails after a successful reference match', async () => {
    setItemsResult({ data: null, error: { message: 'db error' } });

    const res = await GET(
      makeRequest(`http://localhost/api/orders/5?reference=${EXISTING_ORDER.payment_reference}`),
      { params: { id: '5' } }
    );

    expect(res.status).toBe(500);
  });
});
