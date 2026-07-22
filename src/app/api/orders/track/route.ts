import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { orderTrackRatelimit, getClientIp } from '@/lib/ratelimit';

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

export async function POST(request: NextRequest) {
  try {
    if (orderTrackRatelimit) {
      const { success } = await orderTrackRatelimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
    }

    const { order_id, phone } = await request.json();

    if (!order_id || !phone) {
      return NextResponse.json(
        { error: 'Order ID and phone number are required' },
        { status: 400 }
      );
    }

    // Only select the fields this route's consumer (src/app/track/page.tsx,
    // which reads id/customer_address/delivery_lga/total_amount/status/
    // created_at/items) and the ownership check below actually need — the
    // full row also carries customer_email/name and payment_reference, which
    // the frontend never reads and shouldn't be exposed in the response body.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_phone, customer_address, delivery_lga, total_amount, status, created_at')
      .eq('id', order_id)
      .single();

    if (
      orderError ||
      !order ||
      normalizePhone(order.customer_phone) !== normalizePhone(phone)
    ) {
      return NextResponse.json(
        { error: 'No matching order found. Check your order ID and phone number.' },
        { status: 404 }
      );
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity, price_at_time, products ( name )')
      .eq('order_id', order_id);

    if (itemsError) {
      console.error('Order items fetch error:', itemsError);
    }

    const formattedItems = ((items as any[]) || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.products?.name || 'Item',
      quantity: item.quantity,
      price_at_time: item.price_at_time,
    }));

    return NextResponse.json({
      id: order.id,
      customer_address: order.customer_address,
      delivery_lga: order.delivery_lga,
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
      items: formattedItems,
    });
  } catch (error) {
    console.error('Order tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
