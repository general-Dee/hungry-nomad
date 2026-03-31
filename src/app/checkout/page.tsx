'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import { event, metaPixelEvent } from '@/lib/tracking';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart } = useCart();
  const totalAmount = getCartTotal() + 500; // + delivery fee

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paystackReady, setPaystackReady] = useState(false);

  // Load Paystack script
  useEffect(() => {
    if (document.querySelector('#paystack-script')) {
      setPaystackReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackReady(true);
    script.onerror = () => setError('Failed to load payment gateway.');
    document.body.appendChild(script);

    if (cart.length === 0) router.push('/cart');
  }, [cart, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const createOrder = async () => {
    const orderData = {
      ...formData,
      total_amount: totalAmount,
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price_at_time: item.price,
      })),
    };
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create order');
    }
    const { order } = await response.json();
    return order;
  };

  const handlePayment = async () => {
    setError('');
    setLoading(true);

    // Validate form
    if (!formData.customer_name || !formData.customer_email || !formData.customer_phone || !formData.customer_address) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }
    if (!paystackReady) {
      setError('Payment system is still loading. Please wait.');
      setLoading(false);
      return;
    }

    // --- Begin Checkout tracking (GA4 + Meta) ---
    const checkoutItems = cart.map(item => ({
      item_id: item.id.toString(),
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));
    event('begin_checkout', {
      currency: 'NGN',
      value: totalAmount,
      items: checkoutItems,
    });
    metaPixelEvent('InitiateCheckout', {
      value: totalAmount,
      currency: 'NGN',
      num_items: cart.length,
      content_ids: cart.map(i => i.id.toString()),
      contents: cart.map(i => ({ id: i.id.toString(), quantity: i.quantity })),
    });

    try {
      const order = await createOrder();

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: formData.customer_email,
        amount: totalAmount * 100,
        currency: 'NGN',
        metadata: {
          custom_fields: [
            { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
            { display_name: 'Customer Name', variable_name: 'customer_name', value: formData.customer_name },
          ],
        },
        callback: (response: any) => {
          router.push(`/success?reference=${response.reference}&order_id=${order.id}`);
          clearCart();
        },
        onClose: () => router.push('/cancel'),
      });
      handler.openIframe();
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" name="customer_name" value={formData.customer_name} onChange={handleInputChange} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" name="customer_email" value={formData.customer_email} onChange={handleInputChange} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="tel" name="customer_phone" value={formData.customer_phone} onChange={handleInputChange} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                <textarea name="customer_address" value={formData.customer_address} onChange={handleInputChange} rows={3} className="input-field" required />
              </div>
            </div>
          </div>
        </div>
        <div className="lg:w-96">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
            <h2 className="text-xl font-bold mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between"><span>Subtotal</span><span>₦{getCartTotal().toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Delivery Fee</span><span>₦500</span></div>
                <div className="flex justify-between font-bold text-lg pt-2"><span>Total</span><span>₦{totalAmount.toLocaleString()}</span></div>
              </div>
            </div>
            <button onClick={handlePayment} disabled={loading || !paystackReady} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Processing...' : !paystackReady ? 'Loading Payment...' : 'Pay with Paystack'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}