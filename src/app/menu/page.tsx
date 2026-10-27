import { Suspense } from 'react';
import * as Sentry from '@sentry/nextjs';
import MenuContent from './MenuContent';
import WeekendPackages from '@/components/WeekendPackages';
import { supabase } from '@/lib/supabaseClient';
import { withRetry } from '@/lib/fetchWithRetry';
import type { Metadata } from 'next';
import { Product } from '@/types';
import { FALLBACK_CATEGORIES, MenuCategory, hiddenSlugs, isMissingTableError, normaliseCategoryRows } from '@/lib/categories';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Order grills, Nigerian dishes and Chinese food for delivery in Kaduna from Hungry Nomad.',
  alternates: { canonical: '/menu' },
};

export const revalidate = 60;

async function getProducts(): Promise<Product[]> {
  let data;
  try {
    data = await withRetry(
      async (signal) => {
        const { data, error } = await supabase.from('products').select('*').order('name').abortSignal(signal);
        if (error) throw error;
        return data;
      },
      { attempts: 2, timeoutMs: 6000 }
    );
  } catch (error) {
    // CI builds use a placeholder Supabase URL and cannot prerender the menu.
    // A live failed regeneration should still throw so Next keeps the last good page.
    const placeholder = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('example.supabase.co');
    if (placeholder) return [];
    console.error('Failed to fetch products:', error);
    Sentry.captureException(error);
    throw error;
  }

  return (data || []).reduce<Product[]>((acc, curr) => {
    if (curr.category === 'weekend') return acc;
    if (!acc.some((p) => p.id === curr.id)) acc.push(curr);
    return acc;
  }, []);
}

/**
 * Categories in the order set in admin. Never throws: before the admin
 * migration is applied (no categories table), on a placeholder CI build, or
 * if the request fails, it returns the built-in list so the menu still renders.
 */
async function getCategories(): Promise<MenuCategory[]> {
  if ((process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('example.supabase.co')) return FALLBACK_CATEGORIES;
  try {
    const rows = await withRetry(
      async (signal) => {
        const { data, error } = await supabase
          .from('categories')
          .select('slug, name, sort_order, is_active')
          .order('sort_order')
          .abortSignal(signal);
        if (error) throw error;
        return data;
      },
      { attempts: 2, timeoutMs: 4000 }
    );
    return normaliseCategoryRows(rows) ?? FALLBACK_CATEGORIES;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('Failed to fetch categories:', error);
      Sentry.captureException(error);
    }
    return FALLBACK_CATEGORIES;
  }
}

export default async function MenuPage() {
  const [allProducts, categories] = await Promise.all([getProducts(), getCategories()]);
  // Items in a category hidden in admin are left off the menu.
  const hidden = hiddenSlugs(categories);
  const products = hidden.size ? allProducts.filter((p) => !hidden.has(p.category)) : allProducts;

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading menu...</div>}>
      <WeekendPackages />
      <MenuContent initialProducts={products} categories={categories} />
    </Suspense>
  );
}
