'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
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
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-8">
        We couldn&apos;t load this page. Please try again.
      </p>
      <div className="space-x-4">
        <button type="button" onClick={() => reset()} className="btn-primary inline-block">
          Try Again
        </button>
        <Link href="/menu" className="btn-secondary inline-block">Browse Menu</Link>
      </div>
    </div>
  );
}
