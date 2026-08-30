import { describe, it, expect, vi, beforeEach } from 'vitest';

// Direct unit tests for the shared "confirm and mark order paid" logic in
// src/lib/paystackPayment.ts. The route-level tests (verify-payment and
// paystack-webhook) only exercise this indirectly via their own happy-path
// case, so these tests cover the branches that matter most: idempotency,
// amount-mismatch, the concurrent-update (TOCTOU) guard, and error handling.

const { mockAdminFrom, setOrderResult, setUpdateResult, setItemsResult } = vi.hoisted(() => {
  let orderResult: { data: unknown; error: unknown } = {
    data: { total_amount: 1000, status: 'pending' },
    error: null,
  };
  let updateResult: { data: unknown; error: unknown } = {
    data: { id: 5, total_amount: 1000, status: 'paid' },
    error: null,
  };
  let itemsResult: { data: unknown; error: unknown } = { data: [], error: null };

  const mockAdminFrom = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve(orderResult) }) }),
        update: () => ({
          eq: () => ({
            eq: () => ({ select: () => ({ single: () => Promise.resolve(updateResult) }) }),
          }),
        }),
      };
    }
    if (table === 'order_items') {
      return { select: () => ({ eq: () => Promise.resolve(itemsResult) }) };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return {
    mockAdminFrom,
    setOrderResult: (result: { data: unknown; error: unknown }) => {
      orderResult = result;
    },
    setUpdateResult: (result: { data: unknown; error: unknown }) => {
      updateResult = result;
    },
    setItemsResult: (result: { data: unknown; error: unknown }) => {
      itemsResult = result;
    },
  };
});

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}));

const { mockSendOrderConfirmationEmail, mockSendStaffOrderAlertEmail } = vi.hoisted(() => ({
  mockSendOrderConfirmationEmail: vi.fn(),
  mockSendStaffOrderAlertEmail: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
  sendStaffOrderAlertEmail: mockSendStaffOrderAlertEmail,
}));

const { mockSendMetaPurchaseEvent } = vi.hoisted(() => ({
  mockSendMetaPurchaseEvent: vi.fn(),
}));

// Mocked the same way as '@/lib/email' above, since confirmOrderPaid treats
// it identically: a best-effort, fire-and-forget side effect. Kept as a
// factory (rather than a plain object literal) so the "network failure"
// resilience test below can still reach the *real* implementation via
// importOriginal — see that test for why.
vi.mock('@/lib/metaCapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/metaCapi')>();
  return { ...actual, sendMetaPurchaseEvent: mockSendMetaPurchaseEvent };
});

import { confirmOrderPaid, extractOrderIdFromMetadata } from './paystackPayment';

describe('extractOrderIdFromMetadata', () => {
  it('returns null for null metadata', () => {
    expect(extractOrderIdFromMetadata(null)).toBeNull();
  });

  it('returns null for non-object metadata', () => {
    expect(extractOrderIdFromMetadata('not an object')).toBeNull();
    expect(extractOrderIdFromMetadata(42)).toBeNull();
  });

  it('returns null when custom_fields is missing', () => {
    expect(extractOrderIdFromMetadata({})).toBeNull();
  });

  it('returns null when custom_fields is not an array', () => {
    expect(extractOrderIdFromMetadata({ custom_fields: 'nope' })).toBeNull();
  });

  it('returns null when no field has variable_name === "order_id"', () => {
    expect(
      extractOrderIdFromMetadata({
        custom_fields: [{ variable_name: 'phone', value: '123' }],
      })
    ).toBeNull();
  });

  it('returns null when the matching field has value: null', () => {
    expect(
      extractOrderIdFromMetadata({
        custom_fields: [{ variable_name: 'order_id', value: null }],
      })
    ).toBeNull();
  });

  it('returns null when the matching field has value: undefined', () => {
    expect(
      extractOrderIdFromMetadata({
        custom_fields: [{ variable_name: 'order_id' }],
      })
    ).toBeNull();
  });

  it('coerces a numeric value to a string', () => {
    expect(
      extractOrderIdFromMetadata({
        custom_fields: [{ variable_name: 'order_id', value: 5 }],
      })
    ).toBe('5');
  });

  it('returns a string value as-is', () => {
    expect(
      extractOrderIdFromMetadata({
        custom_fields: [{ variable_name: 'order_id', value: '5' }],
      })
    ).toBe('5');
  });
});

describe('confirmOrderPaid', () => {
  beforeEach(() => {
    mockAdminFrom.mockClear();
    mockSendOrderConfirmationEmail.mockClear();
    mockSendStaffOrderAlertEmail.mockClear();
    mockSendMetaPurchaseEvent.mockClear();
    mockSendMetaPurchaseEvent.mockResolvedValue(undefined);
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    setUpdateResult({ data: { id: 5, total_amount: 1000, status: 'paid' }, error: null });
    setItemsResult({ data: [], error: null });
  });

  it('returns 404 when the order is not found', async () => {
    setOrderResult({ data: null, error: { message: 'not found' } });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Order not found');

    // Only the initial select should have run — no update, no email calls.
    const ordersCall = mockAdminFrom.mock.results.find((r, i) => mockAdminFrom.mock.calls[i][0] === 'orders');
    expect(ordersCall).toBeDefined();
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('short-circuits with success when the order is already paid, without updating or emailing', async () => {
    setOrderResult({ data: { total_amount: 1000, status: 'paid' }, error: null });
    const updateSpy = vi.fn();
    mockAdminFrom.mockImplementationOnce((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total_amount: 1000, status: 'paid' }, error: null }) }) }),
          update: updateSpy,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
    expect(mockSendMetaPurchaseEvent).not.toHaveBeenCalled();
  });

  it('rejects with 400 when amountKobo does not match the order total, without updating or emailing', async () => {
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    const updateSpy = vi.fn();
    mockAdminFrom.mockImplementationOnce((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total_amount: 1000, status: 'pending' }, error: null }) }) }),
          update: updateSpy,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 99999, currency: 'NGN' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Payment amount does not match order total' });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('rejects with 400 when currency does not match NGN, without updating or emailing', async () => {
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    const updateSpy = vi.fn();
    mockAdminFrom.mockImplementationOnce((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total_amount: 1000, status: 'pending' }, error: null }) }) }),
          update: updateSpy,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'USD' });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Payment currency does not match expected currency' });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('rejects with 400 when currency is missing from the Paystack response, without updating or emailing', async () => {
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    const updateSpy = vi.fn();
    mockAdminFrom.mockImplementationOnce((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { total_amount: 1000, status: 'pending' }, error: null }) }) }),
          update: updateSpy,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: undefined });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Payment currency does not match expected currency' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not false-positive a mismatch on fractional-kobo totals when the true charged amount is correct', async () => {
    // 1234.005 * 100 === 123400.50000000001 in raw float math (not exactly
    // .5), so Math.round brings this to 123401 — the genuinely charged kobo
    // amount should match that rounded value, not be flagged as a mismatch.
    setOrderResult({ data: { total_amount: 1234.005, status: 'pending' }, error: null });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 123401, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('treats a TOCTOU update returning {data: null, error: null} as already handled (no emails)', async () => {
    setUpdateResult({ data: null, error: null });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('treats a TOCTOU update returning PGRST116 as already handled (no emails)', async () => {
    setUpdateResult({ data: null, error: { code: 'PGRST116', message: 'no rows returned' } });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('returns a generic 500 on a genuine update failure, without leaking the raw Supabase error', async () => {
    setUpdateResult({
      data: null,
      error: { code: 'XX000', message: 'connection to database lost: super secret internal detail' },
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Failed to update order' });
    expect(JSON.stringify(body)).not.toMatch(/connection to database lost/);
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).not.toHaveBeenCalled();
  });

  it('sends both confirmation and staff-alert emails with correctly-shaped items on the happy path', async () => {
    setItemsResult({
      data: [
        { product_id: 1, quantity: 2, price_at_time: 500, products: { name: 'Jollof Rice' } },
        { product_id: 2, quantity: 1, price_at_time: 1000, products: null },
      ],
      error: null,
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    const expectedItems = [
      { product_name: 'Jollof Rice', quantity: 2, price_at_time: 500 },
      { product_name: 'Item', quantity: 1, price_at_time: 1000 },
    ];
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalledWith(
      { id: 5, total_amount: 1000, status: 'paid' },
      expectedItems
    );
    expect(mockSendStaffOrderAlertEmail).toHaveBeenCalledWith(
      { id: 5, total_amount: 1000, status: 'paid' },
      expectedItems
    );
  });

  it('still sends emails and returns success when the order_items fetch errors (logged, not fatal)', async () => {
    setItemsResult({ data: null, error: { message: 'order_items fetch exploded' } });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalledWith(
      { id: 5, total_amount: 1000, status: 'paid' },
      []
    );
    expect(mockSendStaffOrderAlertEmail).toHaveBeenCalledWith(
      { id: 5, total_amount: 1000, status: 'paid' },
      []
    );
  });

  it('invokes sendMetaPurchaseEvent exactly once with the reference, total, product ids and contact details on pending -> paid', async () => {
    setUpdateResult({
      data: {
        id: 5,
        total_amount: 1000,
        status: 'paid',
        customer_email: 'customer@example.com',
        customer_phone: '08012345678',
      },
      error: null,
    });
    setItemsResult({
      data: [
        { product_id: 7, quantity: 2, price_at_time: 300, products: { name: 'Jollof Rice' } },
        { product_id: 9, quantity: 1, price_at_time: 400, products: { name: 'Suya' } },
      ],
      error: null,
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_meta_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    expect(mockSendMetaPurchaseEvent).toHaveBeenCalledTimes(1);
    expect(mockSendMetaPurchaseEvent).toHaveBeenCalledWith({
      eventId: 'ref_meta_1',
      value: 1000,
      contentIds: ['7', '9'],
      email: 'customer@example.com',
      phone: '08012345678',
    });
  });

  it('builds fbc as fb.1.<timestamp>.<fbclid> and passes it through when the order has an fbclid', async () => {
    const now = 1700000000000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    setUpdateResult({
      data: {
        id: 5,
        total_amount: 1000,
        status: 'paid',
        customer_email: 'customer@example.com',
        customer_phone: '08012345678',
        fbclid: 'clid_abc123',
      },
      error: null,
    });

    try {
      const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_fbc_1', amountKobo: 100000, currency: 'NGN' });

      expect(res.status).toBe(200);
      expect(mockSendMetaPurchaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({ fbc: `fb.1.${now}.clid_abc123` })
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('does not pass fbc when the order has no fbclid (older orders / no attribution captured)', async () => {
    setUpdateResult({
      data: {
        id: 5,
        total_amount: 1000,
        status: 'paid',
        customer_email: 'customer@example.com',
        customer_phone: '08012345678',
      },
      error: null,
    });

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_fbc_2', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    expect(mockSendMetaPurchaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fbc: undefined })
    );
  });

  it('still returns success when sendMetaPurchaseEvent rejects (Promise.allSettled guard)', async () => {
    mockSendMetaPurchaseEvent.mockRejectedValueOnce(new Error('unexpected throw'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalled();
    expect(mockSendStaffOrderAlertEmail).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Order confirmation side effect failed:',
      expect.any(Error)
    );
  });

  it('still returns success when the real Meta Conversions API network call fails', async () => {
    // src/lib/metaCapi.ts's real sendMetaPurchaseEvent is documented to
    // never reject (it wraps its own fetch in try/catch) — confirmOrderPaid
    // relies entirely on that guarantee (see the NOTE above), so this test
    // exercises the real, un-mocked implementation with a failing network
    // call to confirm that guarantee actually holds end-to-end.
    process.env.META_CONVERSIONS_API_TOKEN = 'test-token';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'test-pixel';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.resetModules();
    const real = await vi.importActual<typeof import('./metaCapi')>('./metaCapi');
    mockSendMetaPurchaseEvent.mockImplementationOnce(real.sendMetaPurchaseEvent);

    try {
      const res = await confirmOrderPaid({ orderId: 5, reference: 'ref_1', amountKobo: 100000, currency: 'NGN' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
    } finally {
      delete process.env.META_CONVERSIONS_API_TOKEN;
      delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
