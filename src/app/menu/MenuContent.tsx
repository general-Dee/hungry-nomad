'use client';

import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, ProductCategory } from '@/types';
import { useState, useEffect, useMemo } from 'react';

const categories: (ProductCategory | 'all')[] = ['all', 'fast_food', 'regular', 'chinese'];
const categoryLabels = {
  all: 'All',
  fast_food: 'Fast Food',
  regular: 'Regular Dishes',
  chinese: 'Chinese',
};

const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
};

export default function MenuContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as ProductCategory | null;

  const { data: rawProducts = [], isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  // Deduplicate by ID (double‑safety)
  const products = useMemo(() => {
    const map = new Map<number, Product>();
    rawProducts.forEach(p => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    const unique = Array.from(map.values());
    if (unique.length !== rawProducts.length) {
      console.warn(`Deduplicated: ${rawProducts.length} → ${unique.length}`);
    }
    return unique;
  }, [rawProducts]);

  const [active, setActive] = useState<ProductCategory | 'all'>(
    categoryParam && categories.includes(categoryParam) ? categoryParam : 'all'
  );

  useEffect(() => {
    if (categoryParam && categories.includes(categoryParam)) {
      setActive(categoryParam);
    } else if (!categoryParam) {
      setActive('all');
    }
  }, [categoryParam]);

  // Filter and also deduplicate again (just in case)
  const filtered = useMemo(() => {
    const filteredRaw = active === 'all' ? products : products.filter(p => p.category === active);
    // Final uniqueness safeguard
    const seen = new Set<number>();
    const result: Product[] = [];
    for (const p of filteredRaw) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    console.log(`[MenuContent] Rendering ${result.length} items for category "${active}"`);
    return result;
  }, [active, products]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-red-600">
        Failed to load menu. Please refresh the page.
      </div>
    );
  }

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

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 animate-shine rounded-2xl"></div>
          ))}
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