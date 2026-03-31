'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';

const categories: (ProductCategory | 'all')[] = ['all', 'fast_food', 'regular', 'chinese'];
const categoryLabels: Record<string, string> = {
  all: 'All',
  fast_food: 'Fast Food',
  regular: 'Regular Dishes',
  chinese: 'Chinese',
};

export default function MenuContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as ProductCategory | null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ProductCategory | 'all'>(
    categoryParam && categories.includes(categoryParam) ? categoryParam : 'all'
  );

  // Use a ref to track if the component is still mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  // Use a ref to track the current fetch AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name')
          .abortSignal(abortController.signal);

        if (error) throw error;

        // Deduplicate by ID (just in case the API returns duplicates)
        const uniqueProducts = (data || []).reduce((acc: Product[], current) => {
          if (!acc.find(item => item.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);

        if (isMounted.current) {
          setProducts(uniqueProducts);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Ignore, it's fine
          return;
        }
        console.error('Failed to fetch products:', err);
        if (isMounted.current) {
          setProducts([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchAll();
  }, []);

  // Update active when URL category changes
  useEffect(() => {
    if (categoryParam && categories.includes(categoryParam)) {
      setActive(categoryParam);
    } else if (!categoryParam) {
      setActive('all');
    }
  }, [categoryParam]);

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
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}