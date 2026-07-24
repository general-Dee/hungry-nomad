import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidOrderStatus, validateTransition, OrderStatus } from '@/lib/orderStatus';
import { orderGetRatelimit, getClientIp } from '@/lib/ratelimit';
import { requireStaff } from '@/lib/staffAuth';

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
// AUTH: real per-user Supabase Auth, gated on a staff role. The caller must
// send a valid Supabase Auth access token as `Authorization: Bearer <token>`
// (obtained by signing in at /staff/login), and that user's
// `app_metadata.role` must be `'staff'` — see `src/lib/staffAuth.ts` for the
// check and docs/sql/set-staff-role.sql for how the app owner grants the
// role. Unauthenticated/invalid-token requests get 401; authenticated
// requests from a non-staff user get 403. The write itself still goes
// through the service-role client (`supabaseAdmin`, which bypasses RLS) —
// this auth check is what gates who may call this route, not RLS.
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  // Minimal per-user audit trail: real staff auth (see requireStaff above)
  // now identifies exactly which user made this transition, unlike the old
  // shared-secret stopgap. No `orders` schema change was in scope for this
  // change, so this is logged rather than persisted on the row.
  console.log('Order status updated by staff', {
    orderId,
    from: currentStatus,
    to: targetStatus,
    staffUserId: auth.user.id,
    staffEmail: auth.user.email,
  });

  return NextResponse.json({ success: true, order: updatedOrder });
}