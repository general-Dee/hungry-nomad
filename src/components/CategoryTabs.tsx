'use client';

import { motion } from 'framer-motion';
import { ProductCategory } from '@/types';

const categories: { id: ProductCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fast_food', label: 'Fast Food' },
  { id: 'regular', label: 'Regular Dishes' },
  { id: 'chinese', label: 'Chinese' },
];

export default function CategoryTabs({ activeCategory, onCategoryChange }: any) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-10">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className="relative px-5 py-2 rounded-full text-sm font-medium transition-colors"
        >
          {activeCategory === cat.id && (
            <motion.span
              layoutId="activeTab"
              className="absolute inset-0 bg-amber-100 rounded-full"
              transition={{ type: 'spring', duration: 0.5 }}
            />
          )}
          <span className={`relative z-10 ${activeCategory === cat.id ? 'text-amber-700' : 'text-neutral-600'}`}>
            {cat.label}
          </span>
        </button>
      ))}
    </div>
  );
}