'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { reorderItems } from '@/lib/reorder';
import { addRecentOrder, getRecentOrders, RecentOrderRef } from '@/lib/recentOrders';

type OrderItem = {
  product_id: number;
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

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  paid: 'Payment Confirmed',
  delivered: 'Delivered',
  failed: 'Payment Failed',
};

type RecentOrderRow = RecentOrderRef & {
  status?: OrderStatus;
  items?: OrderItem[];
  loading: boolean;
  unavailable?: boolean;
  reordering?: boolean;
  reorderError?: string;
};

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cart, addToCart, updateQuantity } = useCart();
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState('');
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);

  // On mount, look up the live status of any recently placed orders (saved
  // locally on this device at checkout/lookup time) so they can be shown
  // above the manual lookup form without the user re-entering anything.
  useEffect(() => {
    const refs = getRecentOrders();
    if (refs.length === 0) return;

    setRecentOrders(refs.map((r) => ({ ...r, loading: true })));

    refs.forEach(async (ref) => {
      try {
        const res = await fetch('/api/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: String(ref.id), phone: ref.phone }),
        });
        const data = await res.json();
        setRecentOrders((prev) =>
          prev.map((r) =>
            r.id === ref.id
              ? res.ok
                ? { ...r, loading: false, status: data.status, items: data.items }
                : { ...r, loading: false, unavailable: true }
              : r
          )
        );
      } catch {
        setRecentOrders((prev) =>
          prev.map((r) => (r.id === ref.id ? { ...r, loading: false, unavailable: true } : r))
        );
      }
    });
  }, []);

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
      addRecentOrder({ id: data.id, phone });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    setReorderError('');
    try {
      const { addedCount } = await reorderItems(
        order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        { cart, addToCart, updateQuantity }
      );
      if (addedCount === 0) {
        setReorderError('Sorry, none of these items are available anymore.');
        return;
      }
      router.push('/cart');
    } catch (err) {
      setReorderError(err instanceof Error ? err.message : 'Could not reorder right now. Please try again.');
    } finally {
      setReordering(false);
    }
  };

  const handleRecentReorder = async (row: RecentOrderRow) => {
    if (!row.items || row.items.length === 0) return;
    setRecentOrders((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, reordering: true, reorderError: '' } : r))
    );
    try {
      const { addedCount } = await reorderItems(
        row.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        { cart, addToCart, updateQuantity }
      );
      if (addedCount === 0) {
        setRecentOrders((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, reordering: false, reorderError: 'Sorry, none of these items are available anymore.' }
              : r
          )
        );
        return;
      }
      router.push('/cart');
    } catch (err) {
      setRecentOrders((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                reordering: false,
                reorderError: err instanceof Error ? err.message : 'Could not reorder right now. Please try again.',
              }
            : r
        )
      );
    }
  };

  const currentStepIndex =
    order && order.status !== 'failed'
      ? STEPS.findIndex((s) => s.key === order.status)
      : -1;

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-4xl font-display text-center mb-2">Track Your Order</h1>
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

      {recentOrders.length > 0 && (
        <div className="card-glass p-6 mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
          <div className="space-y-4">
            {recentOrders.map((row) => (
              <div
                key={row.id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 ${
                  row.unavailable ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <p className="font-medium">Order #{row.id}</p>
                  <p className="text-xs text-neutral-500">
                    {row.loading
                      ? 'Checking status...'
                      : row.unavailable
                        ? 'Unavailable right now'
                        : row.status
                          ? STATUS_LABELS[row.status]
                          : ''}
                  </p>
                  {row.reorderError && (
                    <p className="text-xs text-red-500 mt-1">{row.reorderError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRecentReorder(row)}
                  disabled={row.loading || row.unavailable || row.reordering || !row.items}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {row.reordering ? 'Adding...' : 'Reorder'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <span className="text-lg font-bold text-accent-600">
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
                        i < currentStepIndex ? 'bg-accent' : 'bg-neutral-200'
                      }`}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                      i <= currentStepIndex ? 'bg-accent text-bg' : 'bg-neutral-200 text-neutral-500'
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

          <div className="border-t pt-3 text-sm text-neutral-500 mb-4">
            <p>
              Delivering to: {order.customer_address}
              {order.delivery_lga ? `, ${order.delivery_lga}` : ''}
            </p>
          </div>

          {reorderError && <p className="text-red-500 text-sm mb-3">{reorderError}</p>}
          <button
            type="button"
            onClick={handleReorder}
            disabled={reordering}
            className="btn-primary w-full disabled:opacity-50"
          >
            {reordering ? 'Adding to cart...' : 'Reorder these items'}
          </button>
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
