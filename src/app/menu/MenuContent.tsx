'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

const categories: (ProductCategory | 'all')[] = ['all', 'fast_food', 'regular', 'chinese', 'icecream', 'beverages'];
const categoryLabels: Record<string, string> = {
  all: 'All',
  fast_food: 'Fast Food',
  regular: 'Regular Dishes',
  chinese: 'Chinese',
  icecream: 'Ice Cream',
  beverages: 'Beverages',
};

// Subcategories for fast food
const fastFoodSubs = ['all', 'grills', 'shawarma', 'fries'];
const fastFoodSubLabels: Record<string, string> = {
  all: 'All Fast Food',
  grills: 'Grills',
  shawarma: 'Shawarma / Wraps',
  fries: 'Fries',
};

// Subcategories for Chinese
const chineseSubs = ['all', 'noodles', 'rice', 'sausages', 'wings', 'extras', 'dips'];
const chineseSubLabels: Record<string, string> = {
  all: 'All Chinese',
  noodles: 'Noodles',
  rice: 'Rice',
  sausages: 'Sausages',
  wings: 'Wings',
  extras: 'Extras',
  dips: 'Dips',
};

// Subcategories for Regular Dishes
const regularSubs = ['all', 'sides'];
const regularSubLabels: Record<string, string> = {
  all: 'All Regular',
  sides: 'Sides',
};

export default function MenuContent({ initialProducts }: { initialProducts: Product[] }) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as ProductCategory | null;

  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>(
    categoryParam && categories.includes(categoryParam) ? categoryParam : 'all'
  );
  const [activeFastSub, setActiveFastSub] = useState<string>('all');
  const [activeChineseSub, setActiveChineseSub] = useState<string>('all');
  const [activeRegularSub, setActiveRegularSub] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (categoryParam && categories.includes(categoryParam)) {
      setActiveCategory(categoryParam);
      setActiveFastSub('all');
      setActiveChineseSub('all');
      setActiveRegularSub('all');
    } else if (!categoryParam) {
      setActiveCategory('all');
      setActiveFastSub('all');
      setActiveChineseSub('all');
      setActiveRegularSub('all');
    }
  }, [categoryParam]);

  const filtered = useMemo(() => {
    let filteredByCategory = activeCategory === 'all'
      ? initialProducts
      : initialProducts.filter(p => p.category === activeCategory);

    if (activeCategory === 'fast_food' && activeFastSub !== 'all') {
      filteredByCategory = filteredByCategory.filter(p => p.subcategory === activeFastSub);
    }
    if (activeCategory === 'chinese' && activeChineseSub !== 'all') {
      filteredByCategory = filteredByCategory.filter(p => p.subcategory === activeChineseSub);
    }
    if (activeCategory === 'regular' && activeRegularSub !== 'all') {
      filteredByCategory = filteredByCategory.filter(p => p.subcategory === activeRegularSub);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filteredByCategory = filteredByCategory.filter(
        p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
      );
    }

    return filteredByCategory;
  }, [activeCategory, activeFastSub, activeChineseSub, activeRegularSub, initialProducts, searchQuery]);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-2">Our Menu</h1>
      <p className="text-center text-neutral-500 mb-8">Crafted with passion, served with joy</p>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8 relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a dish..."
          className="input-field pl-11 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main category tabs */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setActiveFastSub('all');
              setActiveChineseSub('all');
              setActiveRegularSub('all');
            }}
            aria-pressed={activeCategory === cat}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white/60 backdrop-blur-sm text-neutral-700 hover:bg-amber-100'
              }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Subcategory tabs for Fast Food */}
      {activeCategory === 'fast_food' && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {fastFoodSubs.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveFastSub(sub)}
              aria-pressed={activeFastSub === sub}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeFastSub === sub
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {fastFoodSubLabels[sub]}
            </button>
          ))}
        </div>
      )}

      {/* Subcategory tabs for Chinese */}
      {activeCategory === 'chinese' && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {chineseSubs.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveChineseSub(sub)}
              aria-pressed={activeChineseSub === sub}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeChineseSub === sub
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {chineseSubLabels[sub]}
            </button>
          ))}
        </div>
      )}

      {/* Subcategory tabs for Regular Dishes */}
      {activeCategory === 'regular' && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {regularSubs.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveRegularSub(sub)}
              aria-pressed={activeRegularSub === sub}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeRegularSub === sub
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {regularSubLabels[sub]}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-lg font-medium">No dishes match your search.</p>
          <p className="text-sm mt-1">Try a different keyword or category.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${activeFastSub}-${activeChineseSub}-${activeRegularSub}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filtered.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}