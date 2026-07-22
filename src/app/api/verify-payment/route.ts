import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

    const { data: existingOrder, error: fetchOrderError } = await supabaseAdmin
      .from('orders')
      .select('total_amount, status')
      .eq('id', order_id)
      .single();

    if (fetchOrderError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Idempotency guard: the success page calls this endpoint on every mount
    // (refresh, back/forward nav, revisiting a bookmarked URL). If this order
    // was already marked paid by an earlier, legitimate verification, short-
    // circuit here so we don't re-send confirmation/staff-alert emails or
    // re-run the update on every reload.
    if (existingOrder.status === 'paid') {
      return NextResponse.json({ success: true });
    }

    // Paystack's amount is the ground truth for what was actually charged —
    // confirm it matches the order total before marking the order paid, so a
    // request forged with a mismatched order_id/reference pair (or a client
    // that got the Paystack amount changed some other way) can't slip an
    // underpaid order through as 'paid'.
    const expectedAmountKobo = Math.round(existingOrder.total_amount * 100);
    if (data.data.amount !== expectedAmountKobo) {
      console.error('Payment amount mismatch', {
        order_id,
        expected: expectedAmountKobo,
        received: data.data.amount,
      });
      return NextResponse.json(
        { success: false, error: 'Payment amount does not match order total' },
        { status: 400 }
      );
    }

    // Update order status. The `.eq('status', existingOrder.status)` closes a
    // TOCTOU gap: if another concurrent request (double network retry, the
    // success-page effect firing twice, the same link open in two tabs)
    // already flipped this order to 'paid' between our read above and this
    // write, the update matches zero rows instead of racing to send
    // duplicate emails.
    const { data: order, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        payment_reference: reference,
      })
      .eq('id', order_id)
      .eq('status', existingOrder.status)
      .select()
      .single();

    if (!updateError && !order) {
      // No row matched id+status: another request already marked this order
      // paid first. Treat it the same as the already-paid short-circuit
      // above — skip sending emails again.
      return NextResponse.json({ success: true });
    }

    if (updateError) {
      // PGRST116 = "no rows returned" from .single(), which .update().eq(...)
      // hits when the status condition no longer matches (concurrent update).
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ success: true });
      }
      console.error('Order update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    const { data: items, error: itemsError } = await supabaseAdmin
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