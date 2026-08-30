import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendOrderConfirmationEmail, sendStaffOrderAlertEmail } from '@/lib/email';
import { getProductName } from '@/lib/orderItems';
import { sendMetaPurchaseEvent } from '@/lib/metaCapi';

// The only currency the storefront ever charges in — hardcoded client-side
// in checkout/page.tsx's PaystackPop.setup({ currency: 'NGN', ... }).
const EXPECTED_CURRENCY = 'NGN';

interface PaystackCustomField {
  display_name?: string;
  variable_name?: string;
  value?: unknown;
}

/**
 * Paystack echoes back whatever metadata we sent when the charge was
 * initiated (see src/app/checkout/page.tsx's `metadata.custom_fields`) in
 * both the transaction-verify response and the charge.success webhook
 * payload, under `data.metadata.custom_fields`. We stash the order id there
 * specifically so a payment confirmation can be bound to the order it
 * actually paid for, instead of trusting a client-supplied order_id alone.
 *
 * Returns the order id as a string (Paystack may round-trip it as either a
 * string or number depending on how it was sent), or null if it's missing
 * or malformed.
 */
export function extractOrderIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const customFields = (metadata as { custom_fields?: unknown }).custom_fields;
  if (!Array.isArray(customFields)) return null;
  const field = (customFields as PaystackCustomField[]).find(
    (f) => f && f.variable_name === 'order_id'
  );
  if (!field || field.value === undefined || field.value === null) return null;
  return String(field.value);
}

/**
 * Shared "confirm and mark this order paid" logic used by both:
 *  - POST /api/verify-payment — client-initiated, fired once the browser
 *    reaches /success.
 *  - POST /api/paystack-webhook — server-to-server charge.success event, a
 *    second, independent confirmation path so a genuinely successful
 *    payment isn't lost if the browser never completes the /success round
 *    trip (closed tab, crash, lost network, etc).
 *
 * Callers are responsible for verifying the Paystack response/signature and
 * for establishing that `orderId` is the order this specific reference/
 * amount actually paid for (the metadata order_id, cross-checked against the
 * request body for the client path) *before* calling this — this function
 * trusts its inputs.
 */
export async function confirmOrderPaid({
  orderId,
  reference,
  amountKobo,
  currency,
}: {
  orderId: string | number;
  reference: string;
  amountKobo: number;
  currency: string | undefined;
}): Promise<NextResponse> {
  const { data: existingOrder, error: fetchOrderError } = await supabaseAdmin
    .from('orders')
    .select('total_amount, status')
    .eq('id', orderId)
    .single();

  if (fetchOrderError || !existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Idempotency guard: both confirmation paths can fire for the same order
  // (client verification and the webhook racing each other, retries, the
  // success-page effect firing twice, refresh/back-nav on /success). If this
  // order was already marked paid by an earlier, legitimate confirmation,
  // short-circuit here so we don't re-send confirmation/staff-alert emails
  // or re-run the update.
  if (existingOrder.status === 'paid') {
    return NextResponse.json({ success: true });
  }

  // Paystack's currency is also part of the ground truth for what was
  // actually charged — the numeric amount alone is meaningless without it
  // (e.g. a charge for the same numeric amount in a different currency would
  // be a very different real-world value). Every charge this storefront
  // initiates is in NGN (see checkout/page.tsx's PaystackPop.setup), so
  // reject anything else before marking the order paid.
  if (currency !== EXPECTED_CURRENCY) {
    console.error('Payment currency mismatch', {
      order_id: orderId,
      expected: EXPECTED_CURRENCY,
      received: currency,
    });
    return NextResponse.json(
      { success: false, error: 'Payment currency does not match expected currency' },
      { status: 400 }
    );
  }

  // Paystack's amount is the ground truth for what was actually charged —
  // confirm it matches the order total before marking the order paid, so a
  // mismatched amount can't slip an underpaid order through as 'paid'.
  const expectedAmountKobo = Math.round(existingOrder.total_amount * 100);
  if (amountKobo !== expectedAmountKobo) {
    console.error('Payment amount mismatch', {
      order_id: orderId,
      expected: expectedAmountKobo,
      received: amountKobo,
    });
    return NextResponse.json(
      { success: false, error: 'Payment amount does not match order total' },
      { status: 400 }
    );
  }

  // Update order status. `.eq('status', 'pending')` is hardcoded (rather than
  // `existingOrder.status`) so this only ever transitions orders that are
  // currently 'pending' — not just whatever status happened to be read above
  // unchanged. That also closes a TOCTOU gap: if another concurrent request
  // (the other confirmation path, a double network retry, the success-page
  // effect firing twice, the same link open in two tabs) already flipped
  // this order to 'paid' between our read above and this write, the update
  // matches zero rows instead of racing to send duplicate emails.
  //
  // Replay-protection note: Paystack webhook signatures carry no
  // timestamp/nonce, so a captured valid signature+body is replayable
  // indefinitely. The only thing standing between a replayed confirmation
  // and a duplicate "paid" state is this one-way pending -> paid status
  // transition — there's no legitimate flow that moves an order back to
  // 'pending' after it's been paid, so a replay against an already-paid
  // order always lands on the idempotent short-circuit above instead of
  // re-processing. This is an accepted-risk design, not an oversight.
  const { data: order, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      payment_reference: reference,
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select()
    .single();

  if (!updateError && !order) {
    // No row matched id+status: another request already marked this order
    // paid first. Treat it the same as the already-paid short-circuit
    // above — skip sending emails again.
    return NextResponse.json({ success: true });
  }

  if (updateError) {
    // PGRST116 = "no rows returned" from .single(), which .update().eq(...)
    // hits when the status condition no longer matches (concurrent update).
    if (updateError.code === 'PGRST116') {
      return NextResponse.json({ success: true });
    }
    console.error('Order update error:', updateError);
    Sentry.captureException(updateError, {
      tags: { order_update_error_code: updateError.code ?? 'unknown' },
      extra: { order_id: orderId, reference },
    });
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity, price_at_time, products ( name )')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Order items fetch error:', itemsError);
    Sentry.captureException(itemsError, { extra: { order_id: orderId, reference } });
  }

  const emailItems = ((items as any[]) || []).map((item) => ({
    product_name: getProductName(item),
    quantity: item.quantity,
    price_at_time: item.price_at_time,
  }));

  // Build the Meta `fbc` click-id parameter (Meta's documented format:
  // fb.1.<timestamp_ms>.<fbclid>) from whatever was captured client-side and
  // threaded through order creation (src/lib/attribution.ts,
  // src/app/api/orders/route.ts). `fbclid`/`utm_*` columns only exist once
  // docs/sql/add-attribution-columns.sql has been run against the live
  // project, and older orders predate this entirely, so `order.fbclid` may
  // be undefined here — guard for that rather than assuming it's present.
  //
  // There's no `captured_at` column on `orders` (see
  // docs/sql/add-attribution-columns.sql — only the six attribution fields
  // are stored), so a true capture timestamp is never available here.
  // Falling back to Date.now() at send time is a reasonable approximation
  // (Meta only uses this to bound event freshness, not for precise
  // attribution timing) rather than skipping fbc entirely whenever fbclid is
  // present.
  const fbc = order.fbclid ? `fb.1.${Date.now()}.${order.fbclid}` : undefined;

  // Best-effort notifications — a failure here shouldn't fail the payment
  // confirmation. Each callee already guards against throwing internally,
  // but that's an unenforced cross-file contract; wrap this in its own
  // try/catch (and log via allSettled) so a slip-through rejection from any
  // one of them can never prevent this function from returning success once
  // the order has already been committed to 'paid' above.
  const results = await Promise.allSettled([
    sendOrderConfirmationEmail(order, emailItems),
    sendStaffOrderAlertEmail(order, emailItems),
    sendMetaPurchaseEvent({
      eventId: reference,
      value: order.total_amount,
      contentIds: ((items as any[]) || []).map((item) => String(item.product_id)),
      email: order.customer_email,
      phone: order.customer_phone,
      fbc,
    }),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Order confirmation side effect failed:', result.reason);
      Sentry.captureException(result.reason, { extra: { order_id: orderId, reference } });
    }
  }

  return NextResponse.json({ success: true });
}
