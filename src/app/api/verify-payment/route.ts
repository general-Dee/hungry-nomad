import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { confirmOrderPaid, extractOrderIdFromMetadata } from '@/lib/paystackPayment';
import { paymentVerifyRatelimit, getClientIp } from '@/lib/ratelimit';

// Hard timeout for the outbound call to Paystack's verify endpoint below,
// matching the AbortController pattern used elsewhere for outbound calls
// (src/lib/metaCapi.ts, src/lib/fetchWithRetry.ts) so a hung Paystack
// response fails fast with a proper error response instead of dying on the
// platform's own function timeout.
const PAYSTACK_VERIFY_TIMEOUT_MS = 9000;

export async function POST(request: NextRequest) {
  try {
    if (paymentVerifyRatelimit) {
      const { success } = await paymentVerifyRatelimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
    }

    const { reference, order_id } = await request.json();

    if (!reference || !order_id) {
      return NextResponse.json(
        { error: 'Missing reference or order_id' },
        { status: 400 }
      );
    }

    // Verify with Paystack API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_VERIFY_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // `reference` and `order_id` are both client-controlled in this request
    // body — a valid reference for order A could be replayed here with a
    // different order_id (order B) whose total happens to match the same
    // amount. Paystack echoes back the order_id we sent as metadata when the
    // charge was initiated (see checkout/page.tsx), so require that to match
    // the claimed order_id before trusting anything else about this request.
    const metadataOrderId = extractOrderIdFromMetadata(data.data.metadata);
    if (metadataOrderId === null || metadataOrderId !== String(order_id)) {
      console.error('Payment reference/order_id mismatch', {
        claimed_order_id: order_id,
        metadata_order_id: metadataOrderId,
        reference,
      });
      return NextResponse.json(
        { success: false, error: 'Payment reference does not match order' },
        { status: 400 }
      );
    }

    if (typeof data.data.amount !== 'number') {
      console.error('Paystack verify response missing numeric amount', {
        order_id,
        reference,
        amount: data.data.amount,
      });
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    return await confirmOrderPaid({
      orderId: order_id,
      reference,
      amountKobo: data.data.amount,
      currency: data.data.currency,
    });
  } catch (error) {
    console.error('Verification error:', error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
