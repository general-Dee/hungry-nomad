'use client';

export default function OfflinePage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <svg
        className="w-20 h-20 text-amber-500 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-3.536 9.192a9 9 0 010-12.728M9.172 9.172a4 4 0 000 5.656M12 12h.01M3 3l18 18"
        />
      </svg>
      <h1 className="text-3xl font-bold mb-4">You&apos;re Offline</h1>
      <p className="text-gray-600 mb-8">
        We can&apos;t reach Hungry Nomad right now. Check your internet connection and try again.
      </p>
      <div className="space-x-4">
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          Try Again
        </button>
        <a href="/" className="btn-secondary inline-block">
          Go Home
        </a>
      </div>
    </div>
  );
}
