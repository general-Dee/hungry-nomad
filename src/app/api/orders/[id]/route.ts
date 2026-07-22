import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidOrderStatus, validateTransition, OrderStatus } from '@/lib/orderStatus';
import { orderGetRatelimit, getClientIp } from '@/lib/ratelimit';

// GET /api/orders/[id] — fetch an order's details.
//
// `orders.id` is a small sequential integer, so this must not be a bare
// lookup-by-id: anyone could enumerate every order in the system. Callers
// must also prove they already know the order's Paystack payment reference
// (the same ownership-proof pattern used by POST /api/orders/track, which
// requires a matching phone number). If the reference is missing or doesn't
// match, we return 404 either way — never a different status code for
// "order doesn't exist" vs. "reference is wrong" — so the id itself can't be
// enumerated via response-code differences.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (orderGetRatelimit) {
    const { success } = await orderGetRatelimit.limit(getClientIp(request));
    if (!success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
  }

  const orderId = params.id;
  const reference = request.nextUrl.searchParams.get('reference');

  if (!reference) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Only select the fields this route's consumer (src/app/success/page.tsx,
  // which reads total_amount/items) and the ownership check below actually
  // need — the full row also carries customer_email/phone/name and
  // payment_reference, which the frontend never reads and shouldn't be
  // exposed in the response body.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, total_amount, payment_reference')
    .eq('id', orderId)
    .single();

  if (orderError || !order || order.payment_reference !== reference) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select(`
      product_id,
      quantity,
      price_at_time,
      products ( name )
    `)
    .eq('order_id', orderId);

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }

  // The 'products' field is an array with one object because of the nested select
  const formattedItems = (items as any[]).map((item) => ({
    product_id: item.product_id,
    product_name: item.products[0]?.name || 'Unknown',
    quantity: item.quantity,
    price_at_time: item.price_at_time,
  }));

  return NextResponse.json({ id: order.id, total_amount: order.total_amount, items: formattedItems });
}

// ---------------------------------------------------------------------------
// PATCH /api/orders/[id] — transition an order's status.
//
// PROVISIONAL AUTH STOPGAP: this app has no staff-auth system yet (that's the
// future staff/backend app's job to build). Until real auth exists, this
// endpoint is gated by a single shared secret sent as `x-staff-secret`,
// checked against the `STAFF_API_SECRET` env var. This is NOT real
// authentication/authorization — it's one static, unrotatable, all-or-nothing
// credential shared by every caller. Before the staff app relies on this in
// production, replace it with proper per-user staff auth (e.g. Supabase Auth
// with a staff role + RLS policy, or a session-based login). The write
// already goes through the service-role client (`supabaseAdmin`, which
// bypasses RLS) — this PATCH's only gate is the shared-secret check above,
// not RLS.
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staffSecret = process.env.STAFF_API_SECRET;
  if (!staffSecret) {
    // Fail closed: if the stopgap secret isn't configured, no one can use
    // this endpoint rather than it silently being wide open.
    return NextResponse.json(
      { error: 'Order status updates are not configured on this server.' },
      { status: 503 }
    );
  }

  const providedSecret = request.headers.get('x-staff-secret') ?? '';
  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const secretBuffer = Buffer.from(staffSecret, 'utf8');
  const isAuthorized =
    providedBuffer.length === secretBuffer.length &&
    timingSafeEqual(providedBuffer, secretBuffer);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = params.id;

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requestedStatus = body.status;
  if (!isValidOrderStatus(requestedStatus)) {
    return NextResponse.json(
      { error: 'A valid "status" field is required (pending, paid, failed, delivered).' },
      { status: 400 }
    );
  }

  const { data: existingOrder, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (fetchError || !existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const currentStatus = existingOrder.status as OrderStatus;
  const targetStatus = requestedStatus as OrderStatus;

  const result = validateTransition(currentStatus, targetStatus);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: targetStatus })
    .eq('id', orderId)
    .eq('status', currentStatus)
    .select()
    .single();

  if (!updateError && !updatedOrder) {
    // No row matched id+status: another request changed the status between
    // our read and this write (TOCTOU). Surface it as a conflict rather than
    // silently clobbering or masking it as a generic failure.
    return NextResponse.json(
      { error: 'Order status changed concurrently, please retry' },
      { status: 409 }
    );
  }

  if (updateError) {
    // PGRST116 = "no rows returned" from .single(), which .update().eq(...)
    // hits when the status condition no longer matches (concurrent update).
    if (updateError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Order status changed concurrently, please retry' },
        { status: 409 }
      );
    }
    console.error('Order status update error:', updateError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  return NextResponse.json({ success: true, order: updatedOrder });
}