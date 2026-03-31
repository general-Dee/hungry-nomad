'use client';

import { ProductCategory } from '@/types';

interface CategoryTabsProps {
  activeCategory: ProductCategory | 'all';
  onCategoryChange: (category: ProductCategory | 'all') => void;
}

const categories: { id: ProductCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fast_food', label: 'Fast Food' },
  { id: 'regular', label: 'Regular Dishes' },
  { id: 'chinese', label: 'Chinese' },
];

export default function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-10">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === cat.id ? 'bg-amber-100 text-amber-700' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}