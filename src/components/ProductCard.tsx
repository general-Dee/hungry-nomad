'use client';

import Image from 'next/image';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useToast } from './ToastProvider';
import { motion } from 'framer-motion';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const toast = useToast();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group relative bg-white/70 backdrop-blur-sm rounded-2xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
    >
      <div className="relative h-52 w-full overflow-hidden">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute top-3 right-3 bg-amber-500/90 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
          ₦{product.price.toLocaleString()}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-bold text-neutral-800">{product.name}</h3>
        <p className="text-neutral-500 text-sm mt-1 line-clamp-2">{product.description}</p>
        <button
          onClick={() => { addToCart(product); toast(`✨ ${product.name} added`, 'success'); }}
          className="mt-5 w-full bg-gradient-to-r from-amber-600 to-amber-500 text-white py-2.5 rounded-full font-semibold 
                     hover:shadow-lg transition-all transform active:scale-95"
        >
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
}