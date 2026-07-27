export interface OrderItemProductJoin {
  products?: { name: string } | null;
}

/**
 * Extracts the joined product name from an `order_items` row selected with
 * `products ( name )`.
 *
 * `order_items.product_id` is a single-column FK to `products.id` — a
 * to-one relationship, and there is no second/ambiguous FK path between
 * these two tables (see docs/PLATFORM-CONTRACT.md §1, "Relationship
 * summary"). For a to-one relationship like this, supabase-js/PostgREST
 * returns the embedded `products` resource as a single object (or null),
 * never an array. Arrays are only returned for to-many or ambiguous
 * relationships, neither of which applies here.
 *
 * Centralized here so every call site that reads a joined product name off
 * an `order_items` row shares (and only needs to verify) this one
 * assumption, instead of guessing the shape independently.
 */
export function getProductName(item: OrderItemProductJoin, fallback = 'Item'): string {
  return item.products?.name || fallback;
}
