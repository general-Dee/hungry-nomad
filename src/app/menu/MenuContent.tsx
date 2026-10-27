'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types';
import { FALLBACK_CATEGORIES, MenuCategory, menuTabs, subcategoryTabs } from '@/lib/categories';
import ProductCard from '@/components/ProductCard';
import { useFavorites } from '@/context/FavoritesContext';
import { AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';

export default function MenuContent({
  initialProducts,
  categories = FALLBACK_CATEGORIES,
}: {
  initialProducts: Product[];
  /** Categories in sort order (from public.categories, or the built-in fallback). */
  categories?: MenuCategory[];
}) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const tabs = useMemo(
    () => menuTabs(categories, initialProducts.map((p) => p.category)),
    [categories, initialProducts]
  );
  const isTab = (slug: string | null): slug is string => !!slug && tabs.some((t) => t.slug === slug);

  const [activeCategory, setActiveCategory] = useState<string>(isTab(categoryParam) ? categoryParam : 'all');
  const [activeSub, setActiveSub] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9);
  const { favoriteIds } = useFavorites();

  useEffect(() => {
    if (isTab(categoryParam)) {
      setActiveCategory(categoryParam);
      setActiveSub('all');
    } else if (!categoryParam) {
      setActiveCategory('all');
      setActiveSub('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam]);

  const subTabs = useMemo(
    () => subcategoryTabs(tabs.find((t) => t.slug === activeCategory), initialProducts),
    [tabs, activeCategory, initialProducts]
  );

  const filtered = useMemo(() => {
    let filteredByCategory = activeCategory === 'all'
      ? initialProducts
      : initialProducts.filter(p => p.category === activeCategory);

    if (activeCategory !== 'all' && activeSub !== 'all') {
      filteredByCategory = filteredByCategory.filter(p => (p.subcategory || '').trim() === activeSub);
    }

  const query = searchQuery.trim().toLowerCase();
    if (query) {
      filteredByCategory = filteredByCategory.filter(
        p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
      );
    }

    if (showFavoritesOnly) {
      filteredByCategory = filteredByCategory.filter(p => favoriteIds.has(p.id));
    }

    return filteredByCategory;
  }, [activeCategory, activeSub, initialProducts, searchQuery, showFavoritesOnly, favoriteIds]);

  // Reset pagination back to the first page whenever any filter changes.
  useEffect(() => {
    setVisibleCount(9);
  }, [activeCategory, activeSub, searchQuery, showFavoritesOnly]);

  const visibleProducts = filtered.slice(0, visibleCount);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="font-display text-center text-4xl mb-2">Our Menu</h1>
      <p className="text-center text-text/70 mb-8">Crafted with passion, served with joy</p>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8 relative">
        <MagnifyingGlassIcon strokeWidth={2.75} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a dish..."
          aria-label="Search menu"
          className="input-field pl-11 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <XMarkIcon strokeWidth={2.75} className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Favorites filter */}
      <div className="flex justify-center mb-6">
        <button
          type="button"
          onClick={() => setShowFavoritesOnly(v => !v)}
          aria-pressed={showFavoritesOnly}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            showFavoritesOnly ? 'bg-accent text-bg shadow-md' : 'bg-surface text-text hover:bg-accent-100'
          }`}
        >
          <HeartIcon className="w-4 h-4" />
          {showFavoritesOnly ? 'Showing Favorites' : 'Favorites Only'}
        </button>
      </div>

      {/* Main category tabs, in the order set in admin */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {[{ slug: 'all', name: 'All' }, ...tabs].map(cat => (
          <button
            key={cat.slug}
            onClick={() => {
              setActiveCategory(cat.slug);
              setActiveSub('all');
            }}
            aria-pressed={activeCategory === cat.slug}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat.slug
                ? 'bg-accent text-bg shadow-md'
                : 'bg-surface text-text hover:bg-accent-100'
              }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Subcategory tabs for the active category */}
      {subTabs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {subTabs.map(sub => (
            <button
              key={sub.value}
              onClick={() => setActiveSub(sub.value)}
              aria-pressed={activeSub === sub.value}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeSub === sub.value
                  ? 'bg-accent text-bg'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text/60">
          <p className="text-lg font-medium">No dishes match your search.</p>
          <p className="text-sm mt-1">Try a different keyword or category.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence initial={false}>
              {visibleProducts.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
            </AnimatePresence>
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button onClick={() => setVisibleCount(v => v + 9)} className="btn-secondary">
                Load more dishes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}