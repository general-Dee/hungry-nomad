import { Suspense } from 'react';
import * as Sentry from '@sentry/nextjs';
import MenuContent from './MenuContent';
import WeekendPackages from '@/components/WeekendPackages';
import { supabase } from '@/lib/supabaseClient';
import { withRetry } from '@/lib/fetchWithRetry';
import { Product } from '@/types';

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

export default async function MenuPage() {
  const products = await getProducts();

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading menu...</div>}>
      <WeekendPackages />
      <MenuContent initialProducts={products} />
    </Suspense>
  );
}
