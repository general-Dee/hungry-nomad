import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="text-yellow-500 text-6xl mb-4">⚠</div>
      <h1 className="text-3xl font-bold mb-4">Payment Cancelled</h1>
      <p className="text-gray-600 mb-8">Your payment was not completed. You can try again or continue shopping.</p>
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