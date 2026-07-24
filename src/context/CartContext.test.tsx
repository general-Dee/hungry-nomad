import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { CartProvider, useCart } from './CartContext';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';
import { Product } from '@/types';

// Cart state lives entirely client-side (reducer + localStorage), and its
// output (getCartTotal / getCartCount / the item list) feeds every cart and
// checkout UI, so a regression here would be invisible until checkout math
// or the cart badge went wrong. These tests exercise the reducer/context
// directly rather than through a specific component.

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

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

describe('CartContext', () => {
  it('starts empty and marked as loaded once the localStorage read completes', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.cart).toEqual([]);
    // isLoaded flips true after the mount effect runs
    await act(async () => {});
    expect(result.current.isLoaded).toBe(true);
  });

  it('adds a new product to the cart with quantity 1', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(product()));
    expect(result.current.cart).toEqual([{ ...product(), quantity: 1 }]);
  });

  it('increments quantity when the same product is added again instead of duplicating it', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(product());
      result.current.addToCart(product());
    });
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it('clamps quantity at MAX_ITEM_QUANTITY when repeatedly adding the same item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      for (let i = 0; i < MAX_ITEM_QUANTITY + 10; i++) {
        result.current.addToCart(product());
      }
    });
    expect(result.current.cart[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('updateQuantity sets an exact quantity, clamped at MAX_ITEM_QUANTITY', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(product()));
    act(() => result.current.updateQuantity(1, 5));
    expect(result.current.cart[0].quantity).toBe(5);

    act(() => result.current.updateQuantity(1, MAX_ITEM_QUANTITY + 100));
    expect(result.current.cart[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('updateQuantity to zero or below removes the item entirely', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(product()));
    act(() => result.current.updateQuantity(1, 0));
    expect(result.current.cart).toEqual([]);
  });

  it('removeFromCart removes only the targeted item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(product({ id: 1 }));
      result.current.addToCart(product({ id: 2, name: 'Fried Rice' }));
    });
    act(() => result.current.removeFromCart(1));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].id).toBe(2);
  });

  it('clearCart empties the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(product()));
    act(() => result.current.clearCart());
    expect(result.current.cart).toEqual([]);
  });

  it('getCartTotal sums price * quantity across all items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(product({ id: 1, price: 1000 }));
      result.current.addToCart(product({ id: 2, price: 500 }));
      result.current.updateQuantity(1, 3);
    });
    // 1000*3 + 500*1 = 3500
    expect(result.current.getCartTotal()).toBe(3500);
  });

  it('getCartCount sums quantities, not distinct line items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(product({ id: 1 }));
      result.current.addToCart(product({ id: 2 }));
      result.current.updateQuantity(1, 4);
    });
    expect(result.current.getCartCount()).toBe(5);
  });

  it('persists the cart to localStorage after it loads', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {});
    act(() => result.current.addToCart(product()));
    const saved = JSON.parse(localStorage.getItem('cart') ?? '[]');
    expect(saved).toEqual([{ ...product(), quantity: 1 }]);
  });

  it('hydrates cart state from localStorage on mount', async () => {
    localStorage.setItem('cart', JSON.stringify([{ ...product(), quantity: 7 }]));
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {});
    expect(result.current.cart).toEqual([{ ...product(), quantity: 7 }]);
  });

  it('clamps quantities above MAX_ITEM_QUANTITY when hydrating from localStorage', async () => {
    localStorage.setItem('cart', JSON.stringify([{ ...product(), quantity: MAX_ITEM_QUANTITY + 100 }]));
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {});
    expect(result.current.cart[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('ignores corrupt localStorage content and starts with an empty cart', async () => {
    localStorage.setItem('cart', '{not valid json');
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {});
    expect(result.current.cart).toEqual([]);
    expect(result.current.isLoaded).toBe(true);
  });

  it('throws a clear error when useCart is called outside a CartProvider', () => {
    // Silence the expected React error boundary console.error noise for this case.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCart())).toThrow('useCart must be used within a CartProvider');
    spy.mockRestore();
  });
});
