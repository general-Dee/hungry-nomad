import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { orderCreateRatelimit, getClientIp } from '@/lib/ratelimit';

interface OrderRequestBody {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  delivery_lga: string;
  delivery_fee: number;
  total_amount: number;
  items: { product_id: number; quantity: number; price_at_time: number }[];
}

export async function POST(request: NextRequest) {
  try {
    if (orderCreateRatelimit) {
      const { success } = await orderCreateRatelimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: 'Too many orders placed. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
    }

    const body = (await request.json()) as OrderRequestBody;
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      delivery_lga,
      delivery_fee,
      total_amount,
      items,
    } = body;

    if (
      !customer_name ||
      !customer_email ||
      !customer_phone ||
      !customer_address ||
      !delivery_lga ||
      delivery_fee === undefined ||
      !total_amount ||
      !items ||
      items.length === 0
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        delivery_lga,
        delivery_fee,
        total_amount,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_time: item.price_at_time,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}