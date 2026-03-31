import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Fetch order items with product names
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      product_id,
      quantity,
      price_at_time,
      products (name)
    `)
    .eq('order_id', orderId);

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }

  const formattedItems = items.map((item: any) => ({
    product_id: item.product_id,
    product_name: item.products.name,
    quantity: item.quantity,
    price_at_time: item.price_at_time,
  }));

  return NextResponse.json({ ...order, items: formattedItems });
}