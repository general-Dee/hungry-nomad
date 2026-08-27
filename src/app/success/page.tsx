'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/context/CartContext';
import { event, metaPixelEvent } from '@/lib/tracking';

type OrderItem = {
  product_id: number;
  product_name: string;
  price_at_time: number;
  quantity: number;
};

type OrderWithItems = {
  id: string;
  total_amount: number;
  items: OrderItem[];
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);

  const reference = searchParams.get('reference');
  const orderIdParam = searchParams.get('order_id');

  useEffect(() => {
    if (!reference || !orderIdParam) {
      router.push('/');
      return;
    }

    async function verifyPayment() {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference, order_id: orderIdParam }),
        });
        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setOrderId(orderIdParam);
          clearCart();

          // Analytics tracking is best-effort and must never downgrade an
          // already-confirmed success status — a failed/slow/malformed
          // response here shouldn't show the customer an error screen for a
          // payment that actually succeeded.
          try {
            const orderRes = await fetch(`/api/orders/${orderIdParam}?reference=${reference}`);
            const orderData = (await orderRes.json()) as OrderWithItems;

            const hasValidTotal = Number.isFinite(orderData.total_amount) && orderData.total_amount > 0;
            const hasItems = Array.isArray(orderData.items) && orderData.items.length > 0;

            if (!hasValidTotal || !hasItems) {
              console.error('Purchase tracking skipped: invalid order data', orderData);
            } else {
              // GA4 purchase
              event('purchase', {
                transaction_id: orderIdParam,
                value: orderData.total_amount,
                currency: 'NGN',
                tax: 0,
                shipping: 500,
                items: orderData.items.map((item) => ({
                  item_id: item.product_id.toString(),
                  item_name: item.product_name,
                  price: item.price_at_time,
                  quantity: item.quantity,
                })),
              });

              // Meta Pixel purchase — eventID matches the event_id sent by the
              // server-side CAPI Purchase call (src/lib/metaCapi.ts, keyed off
              // the Paystack reference) so Meta's Events Manager can dedupe them.
              metaPixelEvent('Purchase', {
                value: orderData.total_amount,
                currency: 'NGN',
                content_type: 'product',
                transaction_id: orderIdParam,
                content_ids: orderData.items.map((i) => i.product_id.toString()),
                num_items: orderData.items.reduce((acc, i) => acc + i.quantity, 0),
              }, reference ?? undefined);
            }
          } catch (trackingError) {
            console.error('Purchase tracking error:', trackingError);
            Sentry.captureException(trackingError);
          }
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
      }
    }
    verifyPayment();
    // clearCart intentionally omitted: it's not memoized in CartContext, so
    // including it would re-run verifyPayment on unrelated cart-context
    // re-renders. This effect must only re-run when reference/order_id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, orderIdParam, router]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-text/70">Verifying your payment...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center mx-auto mb-4">
          <XMarkIcon className="w-10 h-10 text-neutral-600" strokeWidth={2.75} />
        </div>
        <h1 className="text-2xl font-display mb-4">We&apos;re confirming your payment</h1>
        {orderIdParam && (
          <p className="text-text/70 mb-1">Order ID: <strong>{orderIdParam}</strong></p>
        )}
        <p className="text-text/70 mb-8">
          If you were charged, your order is on its way. You can track its status below, or
          contact support with your order ID if anything looks wrong.
        </p>
        <div className="space-x-4">
          <Link href="/" className="btn-primary inline-block">Return Home</Link>
        </div>
        {orderIdParam && (
          <Link href={`/track?order_id=${orderIdParam}`} className="block mt-6 text-sm text-neutral-500 hover:text-accent-600 transition">
            Track this order
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-accent2-100 flex items-center justify-center mx-auto mb-4">
        <CheckIcon className="w-10 h-10 text-accent2-700" strokeWidth={2.75} />
      </div>
      <h1 className="text-3xl font-display mb-4">Payment Successful!</h1>
      <p className="text-text/70 mb-1">Order ID: <strong>{orderId}</strong></p>
      <p className="text-text/70 mb-4">We will send you a confirmation email shortly.</p>
      <p className="text-text font-medium mb-8">Thank you for your continued patronage — we truly value you and can&apos;t wait to serve you again!</p>
      <div className="space-x-4">
        <Link href="/" className="btn-primary inline-block">Back to Home</Link>
        <Link href="/menu" className="btn-secondary inline-block">Order More</Link>
      </div>
      <Link href={`/track?order_id=${orderId}`} className="block mt-6 text-sm text-neutral-500 hover:text-accent-600 transition">
        Track this order
      </Link>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}