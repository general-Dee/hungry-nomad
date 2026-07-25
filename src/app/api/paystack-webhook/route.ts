import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { confirmOrderPaid, extractOrderIdFromMetadata } from '@/lib/paystackPayment';

// Server-to-server confirmation path for Paystack `charge.success` events —
// a second, independent way an order gets marked paid, so a genuinely
// successful payment isn't lost forever if the customer's browser never
// completes the client-initiated /api/verify-payment call (closed tab,
// crash, lost network, etc after Paystack already charged them).
//
// This must be registered as a webhook URL in the Paystack dashboard
// (Settings -> API Keys & Webhooks) — that registration is a manual step
// outside this codebase.
export async function POST(request: NextRequest) {
  // We need the exact raw bytes Paystack signed — request.json() would
  // re-serialize the body and break the HMAC comparison below.
  const rawBody = await request.text();

  const signature = request.headers.get('x-paystack-signature');
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!signature || !secret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSignature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  // timingSafeEqual throws on mismatched lengths, so check that first —
  // a length mismatch is itself just an invalid signature.
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!signatureValid) {
    console.error('Paystack webhook signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Paystack webhook: malformed JSON body', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const chargeData = payload.data || {};

  // Only charge.success is relevant to marking an order paid — acknowledge
  // everything else with 200 so Paystack doesn't retry it. Also check the
  // charge data's own `status` field (mirroring the outer + inner status
  // check /api/verify-payment does), so this doesn't rely on event type
  // alone if Paystack ever sends charge.success for a non-successful charge
  // or this handler is later widened to other event types.
  if (payload.event !== 'charge.success' || chargeData.status !== 'success') {
    return NextResponse.json({ success: true });
  }

  const reference = chargeData.reference as string | undefined;
  const amountKobo = chargeData.amount as number | undefined;
  const metadataOrderId = extractOrderIdFromMetadata(chargeData.metadata);

  if (!reference || typeof amountKobo !== 'number' || metadataOrderId === null) {
    console.error('Paystack webhook: charge.success payload missing reference/amount/order_id metadata', {
      reference,
      amountKobo,
      metadataOrderId,
    });
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  return await confirmOrderPaid({
    orderId: metadataOrderId,
    reference,
    amountKobo,
  });
}
