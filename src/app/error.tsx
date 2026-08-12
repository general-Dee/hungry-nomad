'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
      <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
        <ExclamationTriangleIcon className="w-10 h-10 text-accent-700" strokeWidth={2.75} />
      </div>
      <h1 className="text-2xl font-display mb-4">Something went wrong</h1>
      <p className="text-neutral-500 mb-8">
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
