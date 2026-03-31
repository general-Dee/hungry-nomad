'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const total = getCartTotal();

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-3xl font-bold">Your cart is empty</h2>
          <p className="text-neutral-500 mt-2">Looks like you haven&apos;t added anything yet.</p>
          <Link href="/menu" className="btn-primary inline-block mt-6">Start ordering</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Your cart</h1>
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-4">
          <AnimatePresence>
            {cart.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="card-glass p-4 flex flex-col sm:flex-row gap-4 items-center"
              >
                <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <p className="text-amber-600 font-medium">₦{item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200">-</button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200">+</button>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 ml-2 text-sm">Remove</button>
                </div>
                <div className="font-bold min-w-[80px] text-right">₦{(item.price * item.quantity).toLocaleString()}</div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button onClick={clearCart} className="text-neutral-500 hover:text-red-500 transition">Clear cart</button>
        </div>

        <div className="lg:w-96">
          <div className="card-glass p-6 sticky top-24">
            <h2 className="text-2xl font-bold mb-4">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span>₦{total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>₦500</span></div>
              <div className="border-t pt-2 mt-2 font-bold text-xl flex justify-between"><span>Total</span><span>₦{(total + 500).toLocaleString()}</span></div>
            </div>
            <Link href="/checkout" className="btn-primary w-full block text-center mt-6">Checkout</Link>
          </div>
        </div>
      </div>
    </div>
  );
}