import { ProductCategory } from '@/types';

export const TAKEAWAY_FEE = 300;

// Max quantity allowed per cart item. Enforced server-side in
// src/app/api/orders/route.ts and mirrored here so the cart UI can stop
// users from exceeding it before they ever reach checkout.
export const MAX_ITEM_QUANTITY = 50;

const TAKEAWAY_CATEGORIES: ProductCategory[] = ['regular', 'chinese'];

export function requiresTakeawayFee(items: { category: ProductCategory }[]): boolean {
  return items.some((item) => TAKEAWAY_CATEGORIES.includes(item.category));
}

export function computeOrderTotal(
  items: { price_at_time: number; quantity: number; category: ProductCategory }[],
  deliveryFee: number
): { subtotal: number; takeawayFee: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0);
  const takeawayFee = requiresTakeawayFee(items) ? TAKEAWAY_FEE : 0;
  const total = subtotal + deliveryFee + takeawayFee;
  return { subtotal, takeawayFee, total };
}
