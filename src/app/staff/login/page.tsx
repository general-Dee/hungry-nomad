'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Minimal staff sign-in page. Real per-user auth replaces the old
// STAFF_API_SECRET stopgap for PATCH /api/orders/[id] — see
// docs/PLATFORM-CONTRACT.md §4 and src/lib/staffAuth.ts. Staff accounts are
// regular Supabase Auth users; being marked "staff" is a separate step the
// app owner performs after signup (docs/sql/set-staff-role.sql). This page
// only handles sign-in — account creation is intentionally not self-serve
// here, since anyone signing themselves up would not yet have the staff
// role and PATCH would still reject them.
export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message || 'Sign-in failed. Check your email and password.');
      return;
    }

    router.push('/staff');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <h1 className="text-3xl font-bold text-center mb-2">Staff Login</h1>
      <p className="text-center text-neutral-500 mb-8">
        Sign in with your staff account to manage order statuses.
      </p>

      <form onSubmit={handleSubmit} className="card-glass p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@hungrynomad.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
