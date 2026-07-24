import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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