import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

export async function POST(request: NextRequest) {
  try {
    const { order_id, phone } = await request.json();

    if (!order_id || !phone) {
      return NextResponse.json(
        { error: 'Order ID and phone number are required' },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
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

    const { data: items, error: itemsError } = await supabase
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

    return NextResponse.json({ ...order, items: formattedItems });
  } catch (error) {
    console.error('Order tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
