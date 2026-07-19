import { ProductCategory } from '@/types';

export const TAKEAWAY_FEE = 300;

const TAKEAWAY_CATEGORIES: ProductCategory[] = ['regular', 'chinese'];

export function requiresTakeawayFee(items: { category: ProductCategory }[]): boolean {
  return items.some((item) => TAKEAWAY_CATEGORIES.includes(item.category));
}
