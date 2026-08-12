'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import { event, metaPixelEvent } from '@/lib/tracking';
import { TAKEAWAY_FEE, requiresTakeawayFee } from '@/lib/pricing';
import { isWithinBusinessHours, BUSINESS_HOURS_LABEL } from '@/lib/businessHours';
import { addRecentOrder } from '@/lib/recentOrders';
import { Order } from '@/types';
import { ChevronLeftIcon, MapPinIcon, ShoppingCartIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const { cart, isLoaded, getCartTotal } = useCart();
  const subtotal = getCartTotal();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const takeawayFee = TAKEAWAY_FEE;
  const [shouldAddTakeaway, setShouldAddTakeaway] = useState(false);
  const [totalAmount, setTotalAmount] = useState(subtotal);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);
  const [zoneLoadError, setZoneLoadError] = useState('');

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
  // Set when the server-computed total (returned by POST /api/orders, the
  // authoritative source of what will actually be charged) differs from the
  // total we displayed to the user while they were filling out the form —
  // e.g. a menu item's price changed between page load and submit. We hold
  // off launching Paystack until the user explicitly confirms the new
  // amount; nothing here changes what gets charged, it only gates whether
  // we proceed to charge it.
  const [priceConfirmation, setPriceConfirmation] = useState<{
    order: Order;
    previousTotal: number;
    newTotal: number;
  } | null>(null);

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

  // Fetch delivery zones. Wrapped in try/catch/finally so a thrown error
  // (e.g. a network hiccup) can't leave loadingZones stuck at true forever —
  // previously that left the LGA field permanently showing "Loading
  // zones..." with no way for the customer to proceed. Also surfaces a
  // visible error + retry action instead of silently rendering an empty,
  // unusable dropdown when the fetch fails or returns no rows.
  //
  // Transient network blips are retried automatically (a few attempts with
  // short backoff) before falling back to the manual "Retry" banner below —
  // that banner stays as the final safety net once auto-retries give up.
  // Each attempt gets a hard timeout via AbortController so a hung request
  // can't stall the whole flow; the abort signal is passed into the
  // Supabase query itself so the underlying fetch is actually cancelled,
  // not just raced against a Promise.
  const fetchZones = useCallback(async () => {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 9000;
    const BASE_BACKOFF_MS = 500;

    setLoadingZones(true);
    setZoneLoadError('');

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .order('lga_name', { ascending: true })
          .abortSignal(controller.signal);
        if (error) throw error;
        if (data && data.length > 0) {
          setDeliveryZones(data);
          setSelectedZoneId(data[0].id);
          setDeliveryFee(data[0].fee);
          setFormData(prev => ({ ...prev, delivery_lga: data[0].lga_name }));
        } else {
          setDeliveryZones([]);
          setZoneLoadError('No delivery areas are available right now. Please try again shortly.');
        }
        setLoadingZones(false);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // All attempts exhausted — log with enough detail to tell an RLS/
    // permission denial (Supabase/PostgREST errors carry .code/.details/
    // .hint) apart from a genuine network failure, since default Sentry
    // serialization of a plain error can lose those fields.
    const supabaseError = lastError as
      | { code?: string; message?: string; details?: string; hint?: string }
      | null;
    console.error('Failed to fetch delivery zones:', lastError);
    Sentry.captureException(lastError, {
      tags: { zone_fetch_error_code: supabaseError?.code ?? 'unknown' },
      extra: {
        supabaseErrorCode: supabaseError?.code,
        supabaseErrorMessage: supabaseError?.message,
        supabaseErrorDetails: supabaseError?.details,
        supabaseErrorHint: supabaseError?.hint,
        attempts: MAX_ATTEMPTS,
      },
    });
    setZoneLoadError('Could not load delivery areas. Please check your connection and try again.');
    setLoadingZones(false);
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Determine if takeaway pack is needed (cart contains Regular or Chinese items)
  useEffect(() => {
    setShouldAddTakeaway(requiresTakeawayFee(cart));
  }, [cart]);

  // Recalculate total
  useEffect(() => {
    let total = subtotal + deliveryFee;
    if (shouldAddTakeaway) total += takeawayFee;
    setTotalAmount(total);
  }, [subtotal, deliveryFee, shouldAddTakeaway, takeawayFee]);

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

  const createOrder = async (): Promise<Order> => {
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

  // Launches the Paystack popup for an already-created order, charging
  // exactly order.total_amount (the server-computed, authoritative figure).
  // This is only ever called once the displayed total is known to match the
  // server's, either because they agreed from the start or because the user
  // explicitly confirmed the updated amount.
  const launchPaystack = (order: Order) => {
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
        addRecentOrder({ id: order.id, phone: formData.customer_phone });
        router.push(`/success?reference=${response.reference}&order_id=${order.id}`);
      },
      onClose: () => router.push('/cancel'),
    });
    handler.openIframe();
  };

  const handleConfirmUpdatedPrice = () => {
    if (!priceConfirmation) return;
    const { order, newTotal } = priceConfirmation;
    setTotalAmount(newTotal);
    setPriceConfirmation(null);
    try {
      launchPaystack(order);
    } catch (err: unknown) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleCancelUpdatedPrice = () => {
    // The order created for this attempt is left as-is (status "pending")
    // and never gets charged — same outcome as closing the Paystack popup
    // without paying. The user's cart and form data are untouched so they
    // can review the updated total and try again if they want to.
    setPriceConfirmation(null);
    setLoading(false);
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

      // order.total_amount is computed server-side from current DB prices —
      // it's the true, authoritative figure that Paystack will actually
      // charge. totalAmount is what we displayed to the user while they
      // filled out the form. If a menu item's price (or the delivery/
      // takeaway fee) changed in between, these can diverge; don't charge
      // the new amount without the user explicitly seeing and confirming it.
      if (order.total_amount !== totalAmount) {
        setPriceConfirmation({ order, previousTotal: totalAmount, newTotal: order.total_amount });
        return;
      }

      launchPaystack(order);
    } catch (err: unknown) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <div className="container mx-auto px-4 py-16 text-center text-neutral-500">Loading your cart...</div>;
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="w-[88px] h-[88px] rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
          <ShoppingCartIcon className="w-11 h-11 text-accent-600" strokeWidth={2.75} />
        </div>
        <h2 className="text-3xl font-display">Your cart is empty</h2>
        <p className="mt-2 text-neutral-500">Add some delicious items to your cart before checking out.</p>
        <Link href="/menu" className="btn-primary mt-6 inline-block">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-neutral-200 transition"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-display text-text">Checkout</h1>
        </div>

        {!isOpen && (
          <div className="mb-6 rounded-2xl bg-accent-100 border border-accent-200 p-4 text-center text-accent-800">
            <p className="font-semibold">We&apos;re currently closed</p>
            <p className="text-sm mt-1">
              Orders can be placed between {BUSINESS_HOURS_LABEL}. Your cart is saved — come back during business hours to check out.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            <div className="card-glass p-6">
              <div className="mb-6 flex items-center gap-2 border-b pb-3">
                <MapPinIcon className="h-5 w-5 text-accent-600" />
                <h2 className="text-lg font-semibold">Delivery Information</h2>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-accent-100 p-4 text-sm text-accent-800">
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text/80">Full name *</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text/80">Email *</label>
                  <input
                    type="email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text/80">Phone number *</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text/80">Delivery address *</label>
                  <textarea
                    name="customer_address"
                    value={formData.customer_address}
                    onChange={handleInputChange}
                    rows={3}
                    className="input-field"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text/80">Local Government Area *</label>
                  {loadingZones ? (
                    <div className="py-2 text-neutral-500">Loading zones...</div>
                  ) : zoneLoadError ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-100 p-3 text-sm text-accent-800">
                      <span>{zoneLoadError}</span>
                      <button
                        type="button"
                        onClick={fetchZones}
                        className="whitespace-nowrap font-medium underline hover:no-underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedZoneId || ''}
                      onChange={(e) => handleZoneChange(Number(e.target.value))}
                      className="input-field"
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
            <div className="sticky top-24 card-glass p-6">
              <h2 className="text-2xl font-display">Order summary</h2>
              <div className="mt-4 divide-y divide-neutral-200">
                <div className="space-y-2 pb-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-text/80">
                        {item.name} <span className="text-neutral-400">x{item.quantity}</span>
                      </span>
                      <span className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text/80">Subtotal</span>
                    <span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text/80">Delivery fee</span>
                    <span>₦{deliveryFee.toLocaleString()}</span>
                  </div>
                  {shouldAddTakeaway && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text/80">Take‑away pack</span>
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
                disabled={loading || !!priceConfirmation || !paystackReady || loadingZones || !selectedZoneId || !isOpen}
                className="btn-primary mt-6 w-full py-3 disabled:opacity-50"
              >
                {!isOpen ? "We're closed right now" : loading ? 'Processing...' : !paystackReady ? 'Loading payment...' : 'Proceed to payment'}
              </button>
              <p className="mt-3 text-center text-xs text-neutral-500">
                You will be redirected to Paystack to complete your payment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {priceConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-update-heading"
        >
          <div className="card-glass w-full max-w-sm p-6">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 text-accent-700" />
              <div>
                <h2 id="price-update-heading" className="text-lg font-semibold text-text">
                  Price updated
                </h2>
                <p className="mt-1 text-sm text-text/80">
                  One or more prices changed since you loaded this page. Please confirm before we charge your card.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-1 rounded-lg bg-neutral-100 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Was</span>
                <span className="text-neutral-500 line-through">₦{priceConfirmation.previousTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-text">
                <span>Now</span>
                <span>₦{priceConfirmation.newTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelUpdatedPrice}
                className="btn-secondary flex-1 text-sm py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpdatedPrice}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Confirm and pay ₦{priceConfirmation.newTotal.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}