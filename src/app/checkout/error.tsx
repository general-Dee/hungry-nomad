'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
        <ExclamationTriangleIcon className="w-10 h-10 text-accent-700" strokeWidth={2.75} />
      </div>
      <h1 className="text-2xl font-display mb-4">Something went wrong at checkout</h1>
      <p className="text-gray-600 mb-8">
        Your payment has not been charged. Please try again, or contact support if the problem continues.
      </p>
      <div className="space-x-4">
        <button type="button" onClick={() => reset()} className="btn-primary inline-block">
          Try Again
        </button>
        <Link href="/" className="btn-secondary inline-block">Return Home</Link>
      </div>
    </div>
  );
}
