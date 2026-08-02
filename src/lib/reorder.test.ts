import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Product, CartItem } from '@/types';

// reorderItems drives the "reorder" flow, replaying a past order's line
// items into the current cart. A regression here would either silently
// drop items from a reorder, duplicate a cart line, or wipe out an
// existing quantity — so these tests cover the merge-vs-add branch, the
// quantity===1 edge case, missing-product handling, and the fetch-error path.

const { mockFrom, setProductsResult } = vi.hoisted(() => {
  let productsResult: { data: unknown; error: unknown } = { data: [], error: null };
  const mockFrom = vi.fn((table: string) => {
    if (table === 'products') {
      return { select: () => ({ in: () => Promise.resolve(productsResult) }) };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });
  return {
    mockFrom,
    setProductsResult: (result: { data: unknown; error: unknown }) => {
      productsResult = result;
    },
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

import { reorderItems } from './reorder';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Jollof Rice',
    description: 'Smoky party jollof',
    price: 2000,
    category: 'regular',
    image_url: '/jollof.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return { ...product(), quantity: 1, ...overrides };
}

describe('reorderItems', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    setProductsResult({ data: [], error: null });
  });

  it('merges quantity into an existing cart item instead of duplicating it', async () => {
    setProductsResult({ data: [product({ id: 1 })], error: null });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();
    const cart = [cartItem({ id: 1, quantity: 2 })];

    const result = await reorderItems([{ product_id: 1, quantity: 3 }], {
      cart,
      addToCart,
      updateQuantity,
    });

    expect(addToCart).not.toHaveBeenCalled();
    expect(updateQuantity).toHaveBeenCalledWith(1, 5);
    expect(result).toEqual({ addedCount: 1 });
  });

  it('adds a new item via addToCart, without calling updateQuantity when quantity is 1', async () => {
    setProductsResult({ data: [product({ id: 1 })], error: null });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();

    const result = await reorderItems([{ product_id: 1, quantity: 1 }], {
      cart: [],
      addToCart,
      updateQuantity,
    });

    expect(addToCart).toHaveBeenCalledWith(product({ id: 1 }));
    expect(updateQuantity).not.toHaveBeenCalled();
    expect(result).toEqual({ addedCount: 1 });
  });

  it('adds a new item via addToCart and sets quantity via updateQuantity when quantity > 1', async () => {
    setProductsResult({ data: [product({ id: 1 })], error: null });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();

    const result = await reorderItems([{ product_id: 1, quantity: 4 }], {
      cart: [],
      addToCart,
      updateQuantity,
    });

    expect(addToCart).toHaveBeenCalledWith(product({ id: 1 }));
    expect(updateQuantity).toHaveBeenCalledWith(1, 4);
    expect(result).toEqual({ addedCount: 1 });
  });

  it('skips an item whose product is missing from the fetched results and does not count it', async () => {
    // Only product 1 comes back from Supabase (e.g. product 2 was deleted/discontinued).
    setProductsResult({ data: [product({ id: 1 })], error: null });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();

    const result = await reorderItems(
      [
        { product_id: 1, quantity: 1 },
        { product_id: 2, quantity: 1 },
      ],
      { cart: [], addToCart, updateQuantity }
    );

    expect(addToCart).toHaveBeenCalledTimes(1);
    expect(addToCart).toHaveBeenCalledWith(product({ id: 1 }));
    expect(result).toEqual({ addedCount: 1 });
  });

  it('returns the correct addedCount for a mixed batch of merges, adds, and missing products', async () => {
    setProductsResult({
      data: [product({ id: 1 }), product({ id: 2, name: 'Fried Rice' })],
      error: null,
    });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();
    const cart = [cartItem({ id: 1, quantity: 1 })];

    const result = await reorderItems(
      [
        { product_id: 1, quantity: 2 }, // merges into existing cart item
        { product_id: 2, quantity: 3 }, // new item, quantity > 1
        { product_id: 99, quantity: 1 }, // missing from fetched products, skipped
      ],
      { cart, addToCart, updateQuantity }
    );

    expect(result).toEqual({ addedCount: 2 });
    expect(updateQuantity).toHaveBeenCalledWith(1, 3);
    expect(addToCart).toHaveBeenCalledWith(product({ id: 2, name: 'Fried Rice' }));
    expect(updateQuantity).toHaveBeenCalledWith(2, 3);
  });

  it('throws a clear error when the Supabase fetch errors', async () => {
    setProductsResult({ data: null, error: { message: 'connection lost' } });
    const addToCart = vi.fn();
    const updateQuantity = vi.fn();

    await expect(
      reorderItems([{ product_id: 1, quantity: 1 }], { cart: [], addToCart, updateQuantity })
    ).rejects.toThrow('Could not reorder right now. Please try again.');

    expect(addToCart).not.toHaveBeenCalled();
    expect(updateQuantity).not.toHaveBeenCalled();
  });

  it('throws a clear error when the Supabase fetch returns no data', async () => {
    setProductsResult({ data: null, error: null });

    await expect(
      reorderItems([{ product_id: 1, quantity: 1 }], {
        cart: [],
        addToCart: vi.fn(),
        updateQuantity: vi.fn(),
      })
    ).rejects.toThrow('Could not reorder right now. Please try again.');
  });
});
