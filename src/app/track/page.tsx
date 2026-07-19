'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type OrderItem = {
  product_name: string;
  quantity: number;
  price_at_time: number;
};

type OrderStatus = 'pending' | 'paid' | 'failed' | 'delivered';

type TrackedOrder = {
  id: number;
  customer_address: string;
  delivery_lga?: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
};

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'paid', label: 'Payment Confirmed' },
  { key: 'delivered', label: 'Delivered' },
];

function TrackContent() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setOrder(data);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex =
    order && order.status !== 'failed'
      ? STEPS.findIndex((s) => s.key === order.status)
      : -1;

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-4xl font-bold text-center mb-2">Track Your Order</h1>
      <p className="text-center text-neutral-500 mb-8">
        Enter your order ID and the phone number used at checkout
      </p>

      <div className="card-glass p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Order ID</label>
          <input
            type="text"
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="input-field"
            placeholder="e.g. 42"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Phone Number</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="input-field"
            placeholder="The phone number used at checkout"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Searching...' : 'Track Order'}
        </button>
      </div>

      {order && (
        <div className="card-glass p-6 mt-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold">Order #{order.id}</h2>
              <p className="text-neutral-500 text-sm">
                {new Date(order.created_at).toLocaleString('en-NG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            <span className="text-lg font-bold text-amber-600">
              ₦{order.total_amount.toLocaleString()}
            </span>
          </div>

          {order.status === 'failed' ? (
            <div className="bg-red-50 text-red-600 rounded-xl p-4 text-center font-medium mb-6">
              Payment failed for this order. Please place a new order or contact us.
            </div>
          ) : (
            <div className="flex items-start justify-between mb-6">
              {STEPS.map((step, i) => (
                <div key={step.key} className="flex-1 flex flex-col items-center text-center relative">
                  {i < STEPS.length - 1 && (
                    <div
                      className={`absolute top-4 left-1/2 w-full h-0.5 ${
                        i < currentStepIndex ? 'bg-amber-500' : 'bg-neutral-200'
                      }`}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                      i <= currentStepIndex ? 'bg-amber-500 text-white' : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs mt-2 text-neutral-600">{step.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-4">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {item.product_name} &times;{item.quantity}
                </span>
                <span>₦{(item.price_at_time * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 text-sm text-neutral-500">
            <p>
              Delivering to: {order.customer_address}
              {order.delivery_lga ? `, ${order.delivery_lga}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading...</div>}>
      <TrackContent />
    </Suspense>
  );
}
