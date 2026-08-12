import { Suspense } from 'react';
import * as Sentry from '@sentry/nextjs';
import MenuContent from './MenuContent';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/types';

export const revalidate = 60;

async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  if (error) {
    // Throw (after logging + Sentry capture) instead of returning [] --
    // this route is ISR-cached (`revalidate = 60`), so silently "succeeding"
    // with an empty list would get cached as the live menu until the next
    // regeneration. Throwing lets Next.js keep serving the last known-good
    // cached page on a failed background regen, and surfaces menu/error.tsx
    // (with a visible retry) instead of a misleading "no dishes match".
    console.error('Failed to fetch products:', error);
    Sentry.captureException(error);
    throw error;
  }

  return (data || []).reduce<Product[]>((acc, curr) => {
    if (!acc.some((p) => p.id === curr.id)) acc.push(curr);
    return acc;
  }, []);
}

export default async function MenuPage() {
  const products = await getProducts();

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading menu...</div>}>
      <MenuContent initialProducts={products} />
    </Suspense>
  );
}
