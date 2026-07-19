'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { Product, CartItem } from '@/types';

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
} | null>(null);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find((item) => item.id === action.payload.id);
      if (existing) {
        return state.map((item) =>
          item.id === action.payload.id ? { ...item, quantity: item.quantity + 1 } : item
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
        item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item
      );
    case 'CLEAR_CART':
      return [];
    case 'HYDRATE':
      return action.payload;
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
  useEffect(() => {
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

  const addToCart = (product: Product) => dispatch({ type: 'ADD_ITEM', payload: product });
  const removeFromCart = (id: number) => dispatch({ type: 'REMOVE_ITEM', payload: id });
  const updateQuantity = (id: number, quantity: number) =>
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  const clearCart = () => dispatch({ type: 'CLEAR_CART' });
  const getCartTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const getCartCount = () => cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoaded,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};