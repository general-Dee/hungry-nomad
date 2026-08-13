import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';

// POST /api/orders derives prices/fees server-side and is the only place the
// per-product quantity cap (MAX_ITEM_QUANTITY) is enforced against a
// tamperable request body, plus (since the delivery-zone resilience fix) the
// only place `getDeliveryZones()`'s result actually turns into a charged
// `delivery_fee`. These tests cover:
//   1. the cap must apply to the *summed* quantity per product_id across the
//      whole `items` array, not just to each array entry in isolation
//      (otherwise splitting one product across multiple entries bypasses it)
//   2. a malformed JSON body must return 400, not fall through to the
//      generic 500 handler
//   3. order creation is indifferent to whether getDeliveryZones() resolved
//      from the live query or the cache fallback — same fee, same 400 on an
//      unrecognized zone either way — and getDeliveryZones()/products
//      failures surface as 503, not the generic 500
//
// getDeliveryZones() has its own dedicated unit tests (src/lib/deliveryZones.test.ts)
// covering its internal retry/cache/validation logic, so it's mocked here
// rather than re-exercised through the full supabase/redis chain.

vi.mock('@/lib/businessHours', () => ({
  isWithinBusinessHours: () => true,
  BUSINESS_HOURS_LABEL: '11:00am – 9:30pm',
}));

// No UPSTASH_REDIS_REST_URL / TOKEN are set in the test env, so the real
// ratelimit module resolves orderCreateRatelimit to null and POST skips rate
// limiting entirely — no need to mock it separately.

const {
  mockSupabaseFrom,
  mockAdminFrom,
  mockGetDeliveryZones,
  setInsertOrderResult,
  setInsertItemsResult,
  setProductsResult,
  setProductsError,
  getLastInsertedOrderPayload,
} = vi.hoisted(() => {
  // Placeholder default, overridden in every test's beforeEach — kept free
  // of any reference to module-level consts (PRODUCT/ZONE, declared further
  // down) since vi.hoisted's callback runs before those declarations exist.
  let productsResult: { data: unknown; error: unknown } = { data: [], error: null };
  // When set, every attempt of the products query rejects (simulating an
  // outage that exhausts withRetry's attempts), instead of resolving with
  // productsResult.
  let productsError: unknown = null;

  const mockSupabaseFrom = vi.fn((table: string) => {
    if (table === 'products') {
      return {
        select: () => ({
          in: () => ({
            abortSignal: () =>
              productsError ? Promise.reject(productsError) : Promise.resolve(productsResult),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  const mockGetDeliveryZones = vi.fn().mockResolvedValue({ zones: [], source: 'live' });

  let insertOrderResult: { data: unknown; error: unknown } = {
    data: { id: 1, total_amount: 0 },
    error: null,
  };
  let insertItemsResult: { data: unknown; error: unknown } = { data: null, error: null };
  let lastInsertedOrderPayload: unknown = null;

  const mockAdminFrom = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        insert: (payload: unknown) => {
          lastInsertedOrderPayload = payload;
          return {
            select: () => ({ single: () => Promise.resolve(insertOrderResult) }),
          };
        },
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
    mockGetDeliveryZones,
    setInsertOrderResult: (result: { data: unknown; error: unknown }) => {
      insertOrderResult = result;
    },
    setInsertItemsResult: (result: { data: unknown; error: unknown }) => {
      insertItemsResult = result;
    },
    setProductsResult: (result: { data: unknown; error: unknown }) => {
      productsResult = result;
    },
    setProductsError: (error: unknown) => {
      productsError = error;
    },
    getLastInsertedOrderPayload: () => lastInsertedOrderPayload,
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockSupabaseFrom },
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}));

vi.mock('@/lib/deliveryZones', () => ({
  getDeliveryZones: mockGetDeliveryZones,
}));

import { POST } from './route';

const PRODUCT = { id: 7, price: 1000, category: 'fast_food' as const };
const ZONE = { id: 1, lga_name: 'Ikeja', fee: 500 };

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

const VALID_ITEMS = [{ product_id: PRODUCT.id, quantity: 2 }];

describe('POST /api/orders', () => {
  beforeEach(() => {
    mockSupabaseFrom.mockClear();
    mockAdminFrom.mockClear();
    mockGetDeliveryZones.mockReset().mockResolvedValue({ zones: [ZONE], source: 'live' });
    setInsertOrderResult({ data: { id: 1, total_amount: 0 }, error: null });
    setInsertItemsResult({ data: null, error: null });
    setProductsResult({ data: [PRODUCT], error: null });
    setProductsError(null);
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

  describe('delivery-zone resilience (getDeliveryZones fallback behavior)', () => {
    it('creates the order using zone.fee when getDeliveryZones resolves from the live source', async () => {
      const LIVE_ZONE = { id: 1, lga_name: 'Ikeja', fee: 500 };
      mockGetDeliveryZones.mockResolvedValue({ zones: [LIVE_ZONE], source: 'live' });

      const res = await POST(makeRequest({ ...VALID_CUSTOMER, items: VALID_ITEMS }));
      expect(res.status).toBe(200);
      expect((getLastInsertedOrderPayload() as { delivery_fee: number }).delivery_fee).toBe(
        LIVE_ZONE.fee
      );
    });

    it('creates the order using zone.fee when getDeliveryZones resolves from the cache fallback', async () => {
      const CACHE_ZONE = { id: 2, lga_name: 'Ikeja', fee: 900 };
      mockGetDeliveryZones.mockResolvedValue({ zones: [CACHE_ZONE], source: 'cache' });

      const res = await POST(makeRequest({ ...VALID_CUSTOMER, items: VALID_ITEMS }));
      expect(res.status).toBe(200);
      expect((getLastInsertedOrderPayload() as { delivery_fee: number }).delivery_fee).toBe(
        CACHE_ZONE.fee
      );
    });

    it('returns 503 (not the generic 500) when getDeliveryZones throws', async () => {
      mockGetDeliveryZones.mockRejectedValue(new Error('connection reset'));

      const res = await POST(makeRequest({ ...VALID_CUSTOMER, items: VALID_ITEMS }));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/Could not verify order details/);
    });

    it('returns 503 when the products lookup exhausts retries', async () => {
      setProductsError(new Error('connection reset'));

      const res = await POST(makeRequest({ ...VALID_CUSTOMER, items: VALID_ITEMS }));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/Could not verify order details/);
    });

    it('still returns 400 "Invalid delivery zone" when the submitted delivery_lga is not among zones from the live source', async () => {
      mockGetDeliveryZones.mockResolvedValue({ zones: [ZONE], source: 'live' });

      const res = await POST(
        makeRequest({ ...VALID_CUSTOMER, delivery_lga: 'Nowhereville', items: VALID_ITEMS })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid delivery zone');
    });

    it('still returns 400 "Invalid delivery zone" when the submitted delivery_lga is not among zones from the cache fallback', async () => {
      mockGetDeliveryZones.mockResolvedValue({
        zones: [{ id: 3, lga_name: 'Surulere', fee: 700 }],
        source: 'cache',
      });

      const res = await POST(
        makeRequest({ ...VALID_CUSTOMER, delivery_lga: 'Ikeja', items: VALID_ITEMS })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid delivery zone');
    });
  });
});
