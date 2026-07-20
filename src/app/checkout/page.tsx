'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import { event, metaPixelEvent } from '@/lib/tracking';
import { TAKEAWAY_FEE, requiresTakeawayFee } from '@/lib/pricing';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from '@/lib/businessHours';
import { ChevronLeftIcon, MapPinIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface DeliveryZone {
  id: number;
  lga_name: string;
  fee: number;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        metadata: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoaded, getCartTotal, clearCart } = useCart();
  const subtotal = getCartTotal();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const takeawayFee = TAKEAWAY_FEE;
  const [shouldAddTakeaway, setShouldAddTakeaway] = useState(false);
  const [totalAmount, setTotalAmount] = useState(subtotal);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    delivery_lga: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paystackReady, setPaystackReady] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  // Check business hours on mount and keep it current while the page is open
  useEffect(() => {
    const check = () => setIsOpen(isWithinBusinessHours());
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
  }, []);

  // Redirect to /cart if it's genuinely empty — but only once the cart has
  // finished loading from localStorage, otherwise this fires on every fresh
  // page load before the saved cart has had a chance to populate.
  useEffect(() => {
    if (isLoaded && cart.length === 0) router.push('/cart');
  }, [isLoaded, cart, router]);

  // Fetch delivery zones
  useEffect(() => {
    async function fetchZones() {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('lga_name', { ascending: true });
      if (!error && data) {
        setDeliveryZones(data);
        if (data.length > 0) {
          setSelectedZoneId(data[0].id);
          setDeliveryFee(data[0].fee);
          setFormData(prev => ({ ...prev, delivery_lga: data[0].lga_name }));
        }
      }
      setLoadingZones(false);
    }
    fetchZones();
  }, []);

  // Determine if takeaway pack is needed (cart contains Regular or Chinese items)
  useEffect(() => {
    setShouldAddTakeaway(requiresTakeawayFee(cart));
  }, [cart]);

  // Recalculate total
  useEffect(() => {
    let total = subtotal + deliveryFee;
    if (shouldAddTakeaway) total += takeawayFee;
    setTotalAmount(total);
  }, [subtotal, deliveryFee, shouldAddTakeaway]);

  const handleZoneChange = (zoneId: number) => {
    const zone = deliveryZones.find(z => z.id === zoneId);
    if (zone) {
      setSelectedZoneId(zone.id);
      setDeliveryFee(zone.fee);
      setFormData(prev => ({ ...prev, delivery_lga: zone.lga_name }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const createOrder = async () => {
    const orderData = {
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      customer_address: formData.customer_address,
      delivery_lga: formData.delivery_lga,
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
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

    if (!isOpen) {
      setError(`Sorry, we're closed right now. Orders can be placed between ${BUSINESS_HOURS_LABEL}.`);
      setLoading(false);
      return;
    }
    if (!formData.customer_name || !formData.customer_email || !formData.customer_phone || !formData.customer_address) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }
    if (!selectedZoneId) {
      setError('Please select a delivery zone');
      setLoading(false);
      return;
    }
    if (!paystackReady) {
      setError('Payment system is still loading. Please wait.');
      setLoading(false);
      return;
    }

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
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email: formData.customer_email,
        amount: order.total_amount * 100,
        currency: 'NGN',
        metadata: {
          custom_fields: [
            { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
            { display_name: 'Customer Name', variable_name: 'customer_name', value: formData.customer_name },
          ],
        },
        callback: (response: { reference: string }) => {
          router.push(`/success?reference=${response.reference}&order_id=${order.id}`);
          clearCart();
        },
        onClose: () => router.push('/cancel'),
      });
      handler.openIframe();
    } catch (err: unknown) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Loading your cart...</div>;
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCartIcon className="mx-auto h-16 w-16 text-gray-300" />
        <h2 className="mt-4 text-2xl font-semibold">Your cart is empty</h2>
        <p className="mt-2 text-gray-500">Add some delicious items to your cart before checking out.</p>
        <Link href="/menu" className="mt-6 inline-block rounded-full bg-amber-600 px-6 py-2 text-white hover:bg-amber-700">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-gray-200 transition"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Checkout</h1>
        </div>

        {!isOpen && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center text-amber-800">
            <p className="font-semibold">We&apos;re currently closed</p>
            <p className="text-sm mt-1">
              Orders can be placed between {BUSINESS_HOURS_LABEL}. Your cart is saved — come back during business hours to check out.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2 border-b pb-3">
                <MapPinIcon className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold">Delivery Information</h2>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Full name *</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone number *</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Delivery address *</label>
                  <textarea
                    name="customer_address"
                    value={formData.customer_address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Local Government Area *</label>
                  {loadingZones ? (
                    <div className="py-2 text-gray-500">Loading zones...</div>
                  ) : (
                    <select
                      value={selectedZoneId || ''}
                      onChange={(e) => handleZoneChange(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      required
                    >
                      <option value="">Select LGA</option>
                      {deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.lga_name} – ₦{zone.fee.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-96">
            <div className="sticky top-24 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <div className="mt-4 divide-y divide-gray-100">
                <div className="space-y-2 pb-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.name} <span className="text-gray-400">x{item.quantity}</span>
                      </span>
                      <span className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery fee</span>
                    <span>₦{deliveryFee.toLocaleString()}</span>
                  </div>
                  {shouldAddTakeaway && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Take‑away pack</span>
                      <span>₦{takeawayFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total</span>
                    <span>₦{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={loading || !paystackReady || loadingZones || !selectedZoneId || !isOpen}
                className="mt-6 w-full rounded-full bg-amber-600 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {!isOpen ? "We're closed right now" : loading ? 'Processing...' : !paystackReady ? 'Loading payment...' : 'Proceed to payment'}
              </button>
              <p className="mt-3 text-center text-xs text-gray-500">
                You will be redirected to Paystack to complete your payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}