import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { orderCreateRatelimit, getClientIp } from '@/lib/ratelimit';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from '@/lib/businessHours';
import { computeOrderTotal, MAX_ITEM_QUANTITY } from '@/lib/pricing';

interface OrderRequestBody {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  delivery_lga: string;
  items: { product_id: number; quantity: number }[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 200;
const MAX_PHONE_LENGTH = 20;

export async function POST(request: NextRequest) {
  try {
    if (!isWithinBusinessHours()) {
      return NextResponse.json(
        { error: `Sorry, we're closed right now. Orders can be placed between ${BUSINESS_HOURS_LABEL}.` },
        { status: 403 }
      );
    }

    if (orderCreateRatelimit) {
      const { success } = await orderCreateRatelimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: 'Too many orders placed. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
    }

    let body: OrderRequestBody;
    try {
      body = (await request.json()) as OrderRequestBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { customer_name, customer_email, customer_phone, customer_address, delivery_lga, items } = body;

    if (
      !customer_name ||
      typeof customer_name !== 'string' ||
      customer_name.length > MAX_NAME_LENGTH ||
      !customer_email ||
      typeof customer_email !== 'string' ||
      !EMAIL_REGEX.test(customer_email) ||
      !customer_phone ||
      typeof customer_phone !== 'string' ||
      customer_phone.length > MAX_PHONE_LENGTH ||
      !customer_address ||
      typeof customer_address !== 'string' ||
      customer_address.length > MAX_ADDRESS_LENGTH ||
      !delivery_lga
    ) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items must be a non-empty array' }, { status: 400 });
    }

    if (
      items.some(
        (item) => !item.product_id || !item.quantity || item.quantity <= 0 || item.quantity > MAX_ITEM_QUANTITY
      )
    ) {
      return NextResponse.json(
        { error: `Each item must have a valid quantity between 1 and ${MAX_ITEM_QUANTITY}` },
        { status: 400 }
      );
    }

    // A single product can legitimately appear as more than one entry in
    // `items` (the client shouldn't rely on this, but nothing stops it), so
    // the per-entry check above isn't enough on its own — sum quantities by
    // product_id across the whole array and cap the total, otherwise the
    // per-item cap can be bypassed by splitting one product across entries.
    const quantityByProduct = new Map<number, number>();
    for (const item of items) {
      quantityByProduct.set(item.product_id, (quantityByProduct.get(item.product_id) || 0) + item.quantity);
    }
    if ([...quantityByProduct.values()].some((qty) => qty > MAX_ITEM_QUANTITY)) {
      return NextResponse.json(
        { error: `Each item must have a valid quantity between 1 and ${MAX_ITEM_QUANTITY}` },
        { status: 400 }
      );
    }

    // Prices, delivery fee, and takeaway fee are always derived from the
    // database here — the client only supplies product IDs, quantities and a
    // delivery zone name, never money amounts, so a tampered request can't
    // change what actually gets charged.
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, category')
      .in('id', productIds);

    if (productsError || !products || products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more items are unavailable' }, { status: 400 });
    }

    const { data: zone, error: zoneError } = await supabase
      .from('delivery_zones')
      .select('lga_name, fee')
      .eq('lga_name', delivery_lga)
      .single();

    if (zoneError || !zone) {
      return NextResponse.json({ error: 'Invalid delivery zone' }, { status: 400 });
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const orderItems = items.map((item) => {
      const product = productById.get(item.product_id)!;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time: product.price,
        category: product.category,
      };
    });

    const deliveryFee = zone.fee;
    const { total: total_amount } = computeOrderTotal(orderItems, deliveryFee);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        delivery_lga: zone.lga_name,
        delivery_fee: deliveryFee,
        total_amount,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
      orderItems.map(({ product_id, quantity, price_at_time }) => ({
        order_id: order.id,
        product_id,
        quantity,
        price_at_time,
      }))
    );

    if (itemsError) {
      console.error('Order items error:', itemsError);
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
