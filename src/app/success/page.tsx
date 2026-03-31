'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { event, metaPixelEvent } from '@/lib/tracking';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);

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
          // Fetch order details to fire purchase event with items
          const orderRes = await fetch(`/api/orders/${orderIdParam}`);
          const orderData = await orderRes.json();
          setOrderDetails(orderData);

          // --- Purchase event (GA4) ---
          event('purchase', {
            transaction_id: orderIdParam,
            value: orderData.total_amount,
            currency: 'NGN',
            tax: 0,
            shipping: 500,
            items: orderData.items.map((item: any) => ({
              item_id: item.product_id.toString(),
              item_name: item.product_name,
              price: item.price_at_time,
              quantity: item.quantity,
            })),
          });

          // --- Purchase event (Meta Pixel) ---
          metaPixelEvent('Purchase', {
            value: orderData.total_amount,
            currency: 'NGN',
            transaction_id: orderIdParam,
            content_ids: orderData.items.map((i: any) => i.product_id.toString()),
            num_items: orderData.items.reduce((acc: number, i: any) => acc + i.quantity, 0),
          });
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
      }
    }
    verifyPayment();
  }, [reference, orderIdParam, router]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Verifying your payment...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-red-500 text-6xl mb-4">✗</div>
        <h1 className="text-2xl font-bold mb-4">Payment Verification Failed</h1>
        <p className="text-gray-600 mb-8">Please contact support.</p>
        <Link href="/" className="btn-primary inline-block">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="text-green-500 text-6xl mb-4">✓</div>
      <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
      <p className="text-gray-600 mb-4">Thank you for your order. Order ID: <strong>{orderId}</strong></p>
      <p className="text-gray-600 mb-8">We will send you a confirmation email shortly.</p>
      <div className="space-x-4">
        <Link href="/" className="btn-primary inline-block">Return Home</Link>
        <Link href="/menu" className="btn-secondary inline-block">Order More</Link>
      </div>
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