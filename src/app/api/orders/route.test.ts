import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';

// POST /api/orders derives prices/fees server-side and is the only place the
// per-product quantity cap (MAX_ITEM_QUANTITY) is enforced against a
// tamperable request body, so these tests focus on the two request-body
// validation bugs fixed here:
//   1. the cap must apply to the *summed* quantity per product_id across the
//      whole `items` array, not just to each array entry in isolation
//      (otherwise splitting one product across multiple entries bypasses it)
//   2. a malformed JSON body must return 400, not fall through to the
//      generic 500 handler

vi.mock('@/lib/businessHours', () => ({
  isWithinBusinessHours: () => true,
  BUSINESS_HOURS_LABEL: '11:00am – 9:30pm',
}));

// No UPSTASH_REDIS_REST_URL / TOKEN are set in the test env, so the real
// ratelimit module resolves orderCreateRatelimit to null and POST skips rate
// limiting entirely — no need to mock it separately.

const PRODUCT = { id: 7, price: 1000, category: 'fast_food' as const };
const ZONE = { lga_name: 'Ikeja', fee: 500 };

const { mockSupabaseFrom, mockAdminFrom, setInsertOrderResult, setInsertItemsResult } = vi.hoisted(() => {
  const mockSupabaseFrom = vi.fn((table: string) => {
    if (table === 'products') {
      return { select: () => ({ in: () => Promise.resolve({ data: [PRODUCT], error: null }) }) };
    }
    if (table === 'delivery_zones') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: ZONE, error: null }) }) }),
      };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  let insertOrderResult: { data: unknown; error: unknown } = {
    data: { id: 1, total_amount: 0 },
    error: null,
  };
  let insertItemsResult: { data: unknown; error: unknown } = { data: null, error: null };

  const mockAdminFrom = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        insert: () => ({
          select: () => ({ single: () => Promise.resolve(insertOrderResult) }),
        }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      };
    }
    if (table === 'order_items') {
      return { insert: () => Promise.resolve(insertItemsResult) };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return {
    mockSupabaseFrom,
    mockAdminFrom,
    setInsertOrderResult: (result: { data: unknown; error: unknown }) => {
      insertOrderResult = result;
    },
    setInsertItemsResult: (result: { data: unknown; error: unknown }) => {
      insertItemsResult = result;
    },
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_CUSTOMER = {
  customer_name: 'Ada',
  customer_email: 'ada@example.com',
  customer_phone: '08012345678',
  customer_address: '1 Test Street',
  delivery_lga: 'Ikeja',
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    mockSupabaseFrom.mockClear();
    mockAdminFrom.mockClear();
    setInsertOrderResult({ data: { id: 1, total_amount: 0 }, error: null });
    setInsertItemsResult({ data: null, error: null });
  });

  it('returns 400 with a clear message when the JSON body is malformed', async () => {
    const res = await POST(makeRequest('{not valid json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('rejects a single item entry exceeding MAX_ITEM_QUANTITY', async () => {
    const res = await POST(
      makeRequest({
        ...VALID_CUSTOMER,
        items: [{ product_id: PRODUCT.id, quantity: MAX_ITEM_QUANTITY + 1 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects the same product_id split across multiple entries whose summed quantity exceeds the cap', async () => {
    // Each entry is individually within the cap (50), but together they
    // total 100 for the same product — this is exactly the bypass the fix
    // closes.
    const res = await POST(
      makeRequest({
        ...VALID_CUSTOMER,
        items: [
          { product_id: PRODUCT.id, quantity: MAX_ITEM_QUANTITY },
          { product_id: PRODUCT.id, quantity: MAX_ITEM_QUANTITY },
        ],
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid quantity/);
  });

  it('accepts the same product_id split across multiple entries when the summed quantity is within the cap', async () => {
    const res = await POST(
      makeRequest({
        ...VALID_CUSTOMER,
        items: [
          { product_id: PRODUCT.id, quantity: 20 },
          { product_id: PRODUCT.id, quantity: 20 },
        ],
      })
    );
    expect(res.status).toBe(200);
  });
});
