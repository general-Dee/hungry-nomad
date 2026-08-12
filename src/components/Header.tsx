'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';
import { motion, AnimatePresence } from 'framer-motion';
import OpenStatusBadge from './OpenStatusBadge';

export default function Header() {
  const { getCartCount } = useCart();
  const { openDrawer } = useCartDrawer();
  const count = getCartCount();

  return (
    <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-[10px] border-b border-neutral-300/40">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-[22px] leading-none">
            <span className="text-text">Hungry</span>
            <span className="text-accent"> Nomad</span>
          </Link>
          <OpenStatusBadge className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/menu">Menu</NavLink>
            <NavLink href="/track">Track order</NavLink>
          </nav>

          <button
            onClick={openDrawer}
            aria-label="Open cart"
            className="relative w-10 h-10 rounded-full bg-accent-100 hover:bg-accent-200 flex items-center justify-center transition"
          >
            <CartIcon />
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1.5 -right-1.5 bg-accent text-bg text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`text-sm font-semibold transition-colors ${
        isActive ? 'text-accent-700' : 'text-text hover:text-accent-700'
      }`}
    >
      {children}
    </Link>
  );
}

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.75} stroke="currentColor" className="w-5 h-5 text-accent-700">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}