'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';
import { TAKEAWAY_FEE, requiresTakeawayFee } from '@/lib/pricing';

export default function CartDrawer() {
  const { isOpen, closeDrawer } = useCartDrawer();
  const { cart, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const total = getCartTotal();
  const takeawayFee = requiresTakeawayFee(cart) ? TAKEAWAY_FEE : 0;

  // Prevent background scroll while the drawer is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <h2 className="text-xl font-bold">Your Cart</h2>
              <button
                onClick={closeDrawer}
                aria-label="Close cart"
                className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-lg font-bold">Your cart is empty</h3>
                <p className="text-neutral-500 mt-1 text-sm">Add something tasty from the menu.</p>
                <Link href="/menu" onClick={closeDrawer} className="btn-primary mt-6 inline-block">
                  Browse menu
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 items-center">
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                        <Image src={item.image_url} alt={item.name} fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <p className="text-amber-600 text-sm font-medium">₦{item.price.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-sm font-bold"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-sm font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="font-bold text-sm">₦{(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neutral-200 px-5 py-4 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>₦{total.toLocaleString()}</span></div>
                  {takeawayFee > 0 && (
                    <div className="flex justify-between text-sm"><span>Takeaway pack fee</span><span>₦{takeawayFee.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between text-sm text-neutral-500"><span>Delivery</span><span>Calculated at checkout</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Estimated total</span><span>₦{(total + takeawayFee).toLocaleString()}</span>
                  </div>
                  <Link href="/checkout" onClick={closeDrawer} className="btn-primary w-full block text-center mt-3">
                    Checkout
                  </Link>
                  <Link href="/cart" onClick={closeDrawer} className="block text-center text-sm text-neutral-500 hover:text-amber-600 transition mt-1">
                    View full cart
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
