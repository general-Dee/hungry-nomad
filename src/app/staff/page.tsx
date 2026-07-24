'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { isValidOrderStatus, ORDER_STATUSES, OrderStatus } from '@/lib/orderStatus';

// Minimal staff landing page: not a full order-management dashboard (out of
// scope, see task), just enough to prove PATCH /api/orders/[id] is usable
// end-to-end by a real signed-in staff user. Session check is client-side
// (this app has no middleware.ts / server-side session handling elsewhere
// either) — the real authorization boundary is the server-side check in
// src/lib/staffAuth.ts, which the PATCH call below exercises for real.
export default function StaffPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState<OrderStatus>('paid');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace('/staff/login');
        return;
      }
      setSession(data.session);
      setIsStaff((data.session.user.app_metadata as Record<string, unknown> | undefined)?.role === 'staff');
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/staff/login');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult('');
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Your session expired. Please sign in again.');
        router.replace('/staff/login');
        return;
      }

      if (!isValidOrderStatus(status)) {
        setError('Select a valid status.');
        return;
      }

      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update order status.');
        return;
      }

      setResult(`Order #${data.order.id} is now "${data.order.status}".`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return <div className="container mx-auto px-4 py-12 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Staff</h1>
        <button type="button" onClick={handleSignOut} className="text-sm text-neutral-500 hover:text-amber-600">
          Sign out
        </button>
      </div>
      <p className="text-neutral-500 mb-8">Signed in as {session?.user.email}</p>

      {!isStaff && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm mb-6">
          Your account is signed in but not marked as staff, so order-status
          updates below will be rejected by the server (403). Ask the app
          owner to grant your account the staff role — see
          docs/sql/set-staff-role.sql.
        </div>
      )}

      <form onSubmit={handleSubmit} className="card-glass p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Order ID</label>
          <input
            type="text"
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="input-field"
            placeholder="e.g. 42"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">New Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="input-field"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {result && <p className="text-green-600 text-sm">{result}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? 'Updating...' : 'Update Order Status'}
        </button>
      </form>
    </div>
  );
}
