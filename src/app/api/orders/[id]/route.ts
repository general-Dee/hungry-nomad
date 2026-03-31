import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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