import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabase } from '@/lib/supabaseClient';
import { isValidOrderStatus, validateTransition, OrderStatus } from '@/lib/orderStatus';

type OrderItemWithProduct = {
  product_id: number;
  quantity: number;
  price_at_time: number;
  products: { name: string };
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
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

  return NextResponse.json({ ...order, items: formattedItems });
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
// with a staff role + RLS policy, or a session-based login), and consider
// moving the write itself behind a service-role key / RLS policy rather than
// the anon key currently used by `supabase` here.
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

  const { data: existingOrder, error: fetchError } = await supabase
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

  const { data: updatedOrder, error: updateError } = await supabase
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