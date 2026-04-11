'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';

const categories: (ProductCategory | 'all')[] = ['all', 'fast_food', 'regular', 'chinese', 'icecream'];
const categoryLabels: Record<string, string> = {
  all: 'All',
  fast_food: 'Fast Food',
  regular: 'Regular Dishes',
  chinese: 'Chinese',
  icecream: 'Ice Cream',
};

// Subcategories for fast food
const subcategories = ['all', 'grills', 'shawarma'];
const subcategoryLabels: Record<string, string> = {
  all: 'All Fast Food',
  grills: 'Grills',
  shawarma: 'Shawarma / Wraps',
};

export default function MenuContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as ProductCategory | null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>(
    categoryParam && categories.includes(categoryParam) ? categoryParam : 'all'
  );
  const [activeSubcategory, setActiveSubcategory] = useState<string>('all');

  const hasFetched = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');

        if (error) throw error;

        // Deduplicate by id (safety)
        const uniqueProducts = (data || []).reduce<Product[]>((acc, curr) => {
          if (!acc.some(p => p.id === curr.id)) acc.push(curr);
          return acc;
        }, []);

        if (isMounted.current) setProducts(uniqueProducts);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        if (isMounted.current) setProducts([]);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    if (categoryParam && categories.includes(categoryParam)) {
      setActiveCategory(categoryParam);
      setActiveSubcategory('all'); // reset subcategory when main category changes
    } else if (!categoryParam) {
      setActiveCategory('all');
      setActiveSubcategory('all');
    }
  }, [categoryParam]);

  const filtered = useMemo(() => {
    let filteredByCategory = activeCategory === 'all'
      ? products
      : products.filter(p => p.category === activeCategory);

    // Apply subcategory filter only if activeCategory is 'fast_food' and subcategory is not 'all'
    if (activeCategory === 'fast_food' && activeSubcategory !== 'all') {
      filteredByCategory = filteredByCategory.filter(p => p.subcategory === activeSubcategory);
    }
    return filteredByCategory;
  }, [activeCategory, activeSubcategory, products]);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-2">Our Menu</h1>
      <p className="text-center text-neutral-500 mb-8">Crafted with passion, served with joy</p>

      {/* Main category tabs */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setActiveSubcategory('all');
            }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white/60 backdrop-blur-sm text-neutral-700 hover:bg-amber-100'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Subcategory tabs (only for fast food) */}
      {activeCategory === 'fast_food' && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {subcategories.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeSubcategory === sub
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {subcategoryLabels[sub]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => <div key={i} className="h-80 animate-shine rounded-2xl"></div>)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${activeSubcategory}`}
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