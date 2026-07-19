import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendOrderConfirmationEmail, sendStaffOrderAlertEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { reference, order_id } = await request.json();

    if (!reference || !order_id) {
      return NextResponse.json(
        { error: 'Missing reference or order_id' },
        { status: 400 }
      );
    }

    // Verify with Paystack API
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Update order status
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_reference: reference,
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError || !order) {
      console.error('Order update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, price_at_time, products ( name )')
      .eq('order_id', order_id);

    if (itemsError) {
      console.error('Order items fetch error:', itemsError);
    }

    const emailItems = ((items as any[]) || []).map((item) => ({
      product_name: item.products?.name || 'Item',
      quantity: item.quantity,
      price_at_time: item.price_at_time,
    }));

    // Best-effort notifications — a failure here shouldn't fail the payment confirmation.
    await Promise.all([
      sendOrderConfirmationEmail(order, emailItems),
      sendStaffOrderAlertEmail(order, emailItems),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}