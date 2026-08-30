import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// POST /api/verify-payment binds a Paystack `reference` to the specific
// `order_id` it actually paid for via the metadata Paystack echoes back
// (see checkout/page.tsx's metadata.custom_fields), rather than trusting the
// client-supplied order_id alone. These tests focus on that binding check;
// the shared "mark order paid" logic itself lives in
// src/lib/paystackPayment.ts and is exercised indirectly by the "proceeds"
// case here.

const { mockAdminFrom, setOrderResult, setUpdateResult } = vi.hoisted(() => {
  let orderResult: { data: unknown; error: unknown } = {
    data: { total_amount: 1000, status: 'pending' },
    error: null,
  };
  let updateResult: { data: unknown; error: unknown } = {
    data: { id: 5, total_amount: 1000, status: 'paid' },
    error: null,
  };

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
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
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
  };
});

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}));

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: vi.fn(),
  sendStaffOrderAlertEmail: vi.fn(),
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/verify-payment', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function mockPaystackVerify(paystackData: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: true, data: paystackData }),
    })
  );
}

describe('POST /api/verify-payment', () => {
  beforeEach(() => {
    mockAdminFrom.mockClear();
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    setUpdateResult({ data: { id: 5, total_amount: 1000, status: 'paid' }, error: null });
    process.env.PAYSTACK_SECRET_KEY = 'test-secret';
  });

  it('rejects when the reference metadata order_id does not match the claimed order_id', async () => {
    mockPaystackVerify({
      status: 'success',
      amount: 100000,
      metadata: { custom_fields: [{ variable_name: 'order_id', value: '999' }] },
    });

    const res = await POST(makeRequest({ reference: 'ref_123', order_id: '5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not match/);
    // Must reject before ever looking up or updating the order.
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects when the verify response has no metadata at all', async () => {
    mockPaystackVerify({ status: 'success', amount: 100000, metadata: null });

    const res = await POST(makeRequest({ reference: 'ref_123', order_id: '5' }));

    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('proceeds to confirm the order when the metadata order_id matches the claimed order_id', async () => {
    mockPaystackVerify({
      status: 'success',
      amount: 100000,
      currency: 'NGN',
      metadata: { custom_fields: [{ variable_name: 'order_id', value: 5 }] },
    });

    const res = await POST(makeRequest({ reference: 'ref_123', order_id: '5' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAdminFrom).toHaveBeenCalledWith('orders');
  });

  it('rejects when the verified charge currency is not NGN', async () => {
    mockPaystackVerify({
      status: 'success',
      amount: 100000,
      currency: 'USD',
      metadata: { custom_fields: [{ variable_name: 'order_id', value: 5 }] },
    });

    const res = await POST(makeRequest({ reference: 'ref_123', order_id: '5' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Payment currency does not match expected currency' });
  });
});
