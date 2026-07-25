import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

// POST /api/paystack-webhook is the server-to-server confirmation path for
// charge.success events. These tests cover signature verification (the
// gate that must reject anything not genuinely from Paystack) and that a
// validly-signed event is processed via the same shared "mark order paid"
// logic used by /api/verify-payment.

const SECRET = 'test-webhook-secret';

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

function sign(body: string, secret: string) {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

function makeRequest(rawBody: string, signature?: string) {
  return new NextRequest('http://localhost/api/paystack-webhook', {
    method: 'POST',
    body: rawBody,
    headers: signature ? { 'x-paystack-signature': signature } : undefined,
  });
}

const chargeSuccessPayload = {
  event: 'charge.success',
  data: {
    status: 'success',
    reference: 'ref_abc',
    amount: 100000,
    metadata: { custom_fields: [{ variable_name: 'order_id', value: 5 }] },
  },
};
const rawBody = JSON.stringify(chargeSuccessPayload);

describe('POST /api/paystack-webhook', () => {
  beforeEach(() => {
    mockAdminFrom.mockClear();
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    setOrderResult({ data: { total_amount: 1000, status: 'pending' }, error: null });
    setUpdateResult({ data: { id: 5, total_amount: 1000, status: 'paid' }, error: null });
  });

  it('rejects an invalid signature with 401', async () => {
    const res = await POST(makeRequest(rawBody, 'not-a-real-signature'));

    expect(res.status).toBe(401);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects when the signature header is missing', async () => {
    const res = await POST(makeRequest(rawBody));

    expect(res.status).toBe(401);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('processes a validly-signed charge.success event and marks the order paid', async () => {
    const signature = sign(rawBody, SECRET);

    const res = await POST(makeRequest(rawBody, signature));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAdminFrom).toHaveBeenCalledWith('orders');
  });

  it('rejects a validly-signed payload missing the order_id metadata', async () => {
    const payload = {
      event: 'charge.success',
      data: { status: 'success', reference: 'ref_abc', amount: 100000, metadata: null },
    };
    const body = JSON.stringify(payload);
    const signature = sign(body, SECRET);

    const res = await POST(makeRequest(body, signature));

    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('acknowledges a charge.success event whose charge data status is not success', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        status: 'failed',
        reference: 'ref_abc',
        amount: 100000,
        metadata: { custom_fields: [{ variable_name: 'order_id', value: 5 }] },
      },
    };
    const body = JSON.stringify(payload);
    const signature = sign(body, SECRET);

    const res = await POST(makeRequest(body, signature));

    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('acknowledges non charge.success events with 200 without touching the database', async () => {
    const payload = { event: 'transfer.success', data: {} };
    const body = JSON.stringify(payload);
    const signature = sign(body, SECRET);

    const res = await POST(makeRequest(body, signature));

    expect(res.status).toBe(200);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects a validly-signed but syntactically malformed JSON body with a generic 400', async () => {
    // The signature must be computed over this exact malformed string (not
    // over valid JSON) so the request clears signature verification and
    // actually exercises the JSON.parse failure branch, rather than being
    // rejected earlier for a bad signature.
    const malformedBody = '{"event": "charge.success", "data": {';
    const signature = sign(malformedBody, SECRET);

    const res = await POST(makeRequest(malformedBody, signature));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
    expect(JSON.stringify(body)).not.toMatch(/SyntaxError|at JSON\.parse/);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });
});
