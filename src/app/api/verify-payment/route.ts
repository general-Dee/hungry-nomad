import { NextRequest, NextResponse } from 'next/server';
import { confirmOrderPaid, extractOrderIdFromMetadata } from '@/lib/paystackPayment';

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

    // `reference` and `order_id` are both client-controlled in this request
    // body — a valid reference for order A could be replayed here with a
    // different order_id (order B) whose total happens to match the same
    // amount. Paystack echoes back the order_id we sent as metadata when the
    // charge was initiated (see checkout/page.tsx), so require that to match
    // the claimed order_id before trusting anything else about this request.
    const metadataOrderId = extractOrderIdFromMetadata(data.data.metadata);
    if (metadataOrderId === null || metadataOrderId !== String(order_id)) {
      console.error('Payment reference/order_id mismatch', {
        claimed_order_id: order_id,
        metadata_order_id: metadataOrderId,
        reference,
      });
      return NextResponse.json(
        { success: false, error: 'Payment reference does not match order' },
        { status: 400 }
      );
    }

    if (typeof data.data.amount !== 'number') {
      console.error('Paystack verify response missing numeric amount', {
        order_id,
        reference,
        amount: data.data.amount,
      });
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    return await confirmOrderPaid({
      orderId: order_id,
      reference,
      amountKobo: data.data.amount,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
