'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';

const categories: (ProductCategory | 'all')[] = ['all', 'fast_food', 'regular', 'chinese'];
const categoryLabels: Record<string, string> = {
  all: 'All',
  fast_food: 'Fast Food',
  regular: 'Regular',
  chinese: 'Chinese',
};

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ProductCategory | 'all'>('all');

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      setProducts(data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filtered = active === 'all' ? products : products.filter(p => p.category === active);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-2">Our Menu</h1>
      <p className="text-center text-neutral-500 mb-8">Crafted with passion, served with joy</p>

      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              active === cat
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white/60 backdrop-blur-sm text-neutral-700 hover:bg-amber-100'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => <div key={i} className="h-80 animate-shine rounded-2xl"></div>)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}