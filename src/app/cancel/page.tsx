import Link from 'next/link';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function CancelPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
        <ExclamationTriangleIcon className="w-10 h-10 text-accent-700" strokeWidth={2.75} />
      </div>
      <h1 className="text-3xl font-display mb-4">Payment Cancelled</h1>
      <p className="text-text/70 mb-8">Your payment was not completed. You can try again or continue shopping.</p>
      <div className="space-x-4">
        <Link href="/cart" className="btn-primary inline-block">
          Back to Cart
        </Link>
        <Link href="/menu" className="btn-secondary inline-block">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}