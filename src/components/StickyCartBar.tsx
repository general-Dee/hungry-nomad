'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';

const HIDDEN_ROUTES = ['/cart', '/checkout', '/success', '/cancel'];

export default function StickyCartBar() {
  const pathname = usePathname();
  const { getCartCount, getCartTotal } = useCart();
  const count = getCartCount();
  const total = getCartTotal();

  const shouldHide = HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));
  const visible = count > 0 && !shouldHide;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="md:hidden fixed inset-x-0 bottom-0 z-40 p-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <Link
            href="/cart"
            className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-2xl shadow-xl shadow-amber-900/30 px-5 py-3.5"
          >
            <span className="font-semibold">
              {count} item{count > 1 ? 's' : ''} &middot; &#8358;{total.toLocaleString()}
            </span>
            <span className="font-bold flex items-center gap-1">
              View Cart
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
