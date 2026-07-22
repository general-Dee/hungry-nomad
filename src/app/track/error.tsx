'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function TrackError({
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
      <div className="text-red-500 text-6xl mb-4">✗</div>
      <h1 className="text-2xl font-bold mb-4">Couldn&apos;t track your order</h1>
      <p className="text-gray-600 mb-8">
        Something went wrong while looking up your order. Please try again.
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
