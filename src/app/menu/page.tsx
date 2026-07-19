import { Suspense } from 'react';
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
    console.error('Failed to fetch products:', error);
    return [];
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
