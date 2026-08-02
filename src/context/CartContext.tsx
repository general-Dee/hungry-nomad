'use client';

import React, { createContext, useContext, useReducer, useEffect, useLayoutEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { Product, CartItem } from '@/types';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';

// useLayoutEffect warns when run on the server; fall back to useEffect there.
// This lets us hydrate cart state before the browser's next paint (avoiding a
// visible flip from empty -> real state) while still being SSR-safe.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type CartState = CartItem[];

type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartState };

const CartContext = createContext<{
  cart: CartState;
  isLoaded: boolean;
  addToCart: (product: Product) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  maxItemQuantity: number;
} | null>(null);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find((item) => item.id === action.payload.id);
      if (existing) {
        return state.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.min(item.quantity + 1, MAX_ITEM_QUANTITY) }
            : item
        );
      }
      return [...state, { ...action.payload, quantity: 1 }];
    }
    case 'REMOVE_ITEM':
      return state.filter((item) => item.id !== action.payload);
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return state.filter((item) => item.id !== action.payload.id);
      }
      return state.map((item) =>
        item.id === action.payload.id
          ? { ...item, quantity: Math.min(action.payload.quantity, MAX_ITEM_QUANTITY) }
          : item
      );
    case 'CLEAR_CART':
      return [];
    case 'HYDRATE':
      return action.payload.map((item) => ({
        ...item,
        quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY),
      }));
    default:
      return state;
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount. Dispatches HYDRATE once with the
  // full parsed array (rather than replaying ADD_ITEM per item) so this stays
  // correct even if React Strict Mode double-invokes this effect in dev.
  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CartItem[];
        dispatch({ type: 'HYDRATE', payload: parsed });
      } catch {
        // Ignore parse errors – cart will start empty
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage on change (skip until the initial load above has run,
  // so we don't briefly overwrite storage with the empty pre-hydration state)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart, isLoaded]);

  const addToCart = useCallback(
    (product: Product) => dispatch({ type: 'ADD_ITEM', payload: product }),
    []
  );
  const removeFromCart = useCallback((id: number) => dispatch({ type: 'REMOVE_ITEM', payload: id }), []);
  const updateQuantity = useCallback(
    (id: number, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } }),
    []
  );
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const getCartTotal = useCallback(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const getCartCount = useCallback(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      isLoaded,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount,
      maxItemQuantity: MAX_ITEM_QUANTITY,
    }),
    [cart, isLoaded, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};