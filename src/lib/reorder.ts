import { Product, CartItem } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { withRetry } from '@/lib/fetchWithRetry';

export type ReorderLineItem = { product_id: number; quantity: number };
export type ReorderHelpers = {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (id: number, quantity: number) => void;
};

export async function reorderItems(
  items: ReorderLineItem[],
  { cart, addToCart, updateQuantity }: ReorderHelpers
): Promise<{ addedCount: number }> {
  const productIds = items.map((item) => item.product_id);
  let products;
  try {
    products = await withRetry(
      async (signal) => {
        const { data, error } = await supabase.from('products').select('*').in('id', productIds).abortSignal(signal);
        if (error) throw error;
        return data;
      },
      { attempts: 2, timeoutMs: 6000 }
    );
  } catch {
    products = null;
  }

  if (!products) {
    throw new Error('Could not reorder right now. Please try again.');
  }

  let addedCount = 0;
  items.forEach((item) => {
    const product = products.find((p) => p.id === item.product_id);
    if (!product) return;
    const existing = cart.find((c) => c.id === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + item.quantity);
    } else {
      addToCart(product);
      if (item.quantity > 1) updateQuantity(product.id, item.quantity);
    }
    addedCount += 1;
  });

  return { addedCount };
}
